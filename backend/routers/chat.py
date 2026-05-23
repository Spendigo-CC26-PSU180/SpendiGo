from typing import List, Optional
from datetime import date, timedelta
import json
import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from openai import OpenAI, APIError, AuthenticationError, BadRequestError

from core.deps import get_db, get_current_user
from core.config import get_settings
from models.user import User
from models.transaction import Transaction

router = APIRouter(prefix="/chat", tags=["chat"])

settings = get_settings()

# Valid categories
EXPENSE_CATEGORIES = ["makan", "transport", "belanja online", "kopi", "hiburan", "tagihan", "kos/kontrakan", "kesehatan", "pendidikan", "lainnya"]
INCOME_CATEGORIES = ["gaji", "freelance", "bonus", "hadiah", "investasi", "lainnya"]


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


class ActionCard(BaseModel):
    type: str  # "add_transaction" or "view_report"
    label: str
    data: Optional[dict] = None


class ChatResponse(BaseModel):
    reply: str
    suggested_actions: List[ActionCard] = []


def get_user_financial_context(db: Session, user: User) -> str:
    """Build financial context from user's transaction data."""
    today = date.today()
    this_month_start = date(today.year, today.month, 1)
    last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)
    last_month_end = this_month_start - timedelta(days=1)

    # This month's summary
    this_month_income = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == user.id,
        Transaction.date >= this_month_start,
        Transaction.type == "income"
    ).scalar()

    this_month_expense = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == user.id,
        Transaction.date >= this_month_start,
        Transaction.type == "expense"
    ).scalar()

    # Last month's summary
    last_month_expense = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == user.id,
        Transaction.date >= last_month_start,
        Transaction.date <= last_month_end,
        Transaction.type == "expense"
    ).scalar()

    # Category breakdown this month
    category_breakdown = db.query(
        Transaction.category,
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.user_id == user.id,
        Transaction.date >= this_month_start,
        Transaction.type == "expense"
    ).group_by(Transaction.category).order_by(func.sum(Transaction.amount).desc()).limit(5).all()

    # Recent transactions
    recent_transactions = db.query(Transaction).filter(
        Transaction.user_id == user.id
    ).order_by(Transaction.date.desc()).limit(5).all()

    # Build context string
    context = f"""
Data Keuangan User:
- Bulan ini: Pemasukan Rp {this_month_income:,}, Pengeluaran Rp {this_month_expense:,}
- Bulan lalu total pengeluaran: Rp {last_month_expense:,}
- Balance bulan ini: Rp {this_month_income - this_month_expense:,}
"""

    if category_breakdown:
        context += "\nTop Kategori Pengeluaran:\n"
        for cat in category_breakdown:
            context += f"- {cat.category}: Rp {cat.total:,}\n"

    if recent_transactions:
        context += "\nTransaksi Terakhir:\n"
        for tx in recent_transactions:
            context += f"- {tx.date}: {tx.category} Rp {tx.amount:,} ({tx.type})\n"

    return context


def parse_transaction_from_message(client: OpenAI, message: str) -> Optional[dict]:
    """Use AI to parse transaction details from user message."""
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=200,
            messages=[
                {
                    "role": "system",
                    "content": """Extract transaction info from user message. Return JSON only.
Format: {"amount": number, "type": "income"|"expense", "category": string, "description": string}
Categories expense: makan, transport, belanja online, kopi, hiburan, tagihan, kos/kontrakan, kesehatan, pendidikan, lainnya
Categories income: gaji, freelance, bonus, hadiah, investasi, lainnya
If can't parse, return: {"error": true}
Examples:
- "beli kopi 25rb" -> {"amount": 25000, "type": "expense", "category": "kopi", "description": "beli kopi"}
- "gajian 5jt" -> {"amount": 5000000, "type": "income", "category": "gaji", "description": "gajian"}
- "makan siang 35000" -> {"amount": 35000, "type": "expense", "category": "makan", "description": "makan siang"}"""
                },
                {"role": "user", "content": message}
            ]
        )
        result = response.choices[0].message.content.strip()
        # Clean up markdown if present
        result = re.sub(r'^```json\s*', '', result)
        result = re.sub(r'\s*```$', '', result)
        parsed = json.loads(result)
        if parsed.get("error"):
            return None
        return parsed
    except:
        return None


SPEN_SYSTEM_PROMPT = """Kamu adalah Spen, AI financial assistant untuk aplikasi SpendiGo.

GAYA KOMUNIKASI:
- SINGKAT dan TO THE POINT, maksimal 2-3 kalimat per respons
- Casual, pakai "kamu" bukan "Anda"
- Bahasa Indonesia natural, boleh campur bahasa gaul dikit
- Emoji minimal, hanya kalau perlu
- JANGAN bertele-tele atau basa-basi

FORMAT RESPONS:
- Langsung jawab pertanyaan
- Kalau kasih tips, pakai bullet points singkat
- Angka/nominal langsung sebutkan tanpa penjelasan panjang

LARANGAN:
- Jangan minta data sensitif (password, PIN, rekening)
- Jangan beri saran investasi spesifik
"""


@router.post("", response_model=ChatResponse)
def chat_with_spen(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Chat with Spen AI assistant."""

    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Spen AI belum dikonfigurasi. Hubungi admin."
        )

    # Get user's financial context
    financial_context = get_user_financial_context(db, current_user)

    # Build system prompt with context
    system_prompt = f"""{SPEN_SYSTEM_PROMPT}

{financial_context}

Berdasarkan data keuangan di atas, berikan advice yang personalized untuk user.
"""

    # Build messages for OpenAI
    messages = [{"role": "system", "content": system_prompt}]
    for msg in request.history[-10:]:  # Keep last 10 messages for context
        messages.append({
            "role": msg.role,
            "content": msg.content
        })
    messages.append({
        "role": "user",
        "content": request.message
    })

    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=1024,
            messages=messages
        )

        reply = response.choices[0].message.content

        # Generate suggested actions based on the conversation
        suggested_actions = []
        message_lower = request.message.lower()

        # Check if the message contains transaction info
        transaction_keywords = ["beli", "bayar", "makan", "kopi", "gaji", "dapat", "terima", "belanja", "ongkos", "naik", "jajan"]
        amount_pattern = r'\d+[,.]?\d*\s*(rb|ribu|k|jt|juta)?|\d{4,}'

        if any(word in message_lower for word in transaction_keywords) and re.search(amount_pattern, message_lower, re.IGNORECASE):
            # Try to parse transaction details
            parsed = parse_transaction_from_message(client, request.message)
            if parsed and parsed.get("amount"):
                suggested_actions.append(ActionCard(
                    type="save_transaction",
                    label=f"Simpan: {parsed.get('description', 'Transaksi')}",
                    data={
                        "amount": parsed["amount"],
                        "type": parsed["type"],
                        "category": parsed["category"],
                        "description": parsed.get("description", "")
                    }
                ))

        # Check if user asks about reports or analysis
        if any(word in message_lower for word in ["laporan", "report", "analisis", "statistik", "trend"]):
            suggested_actions.append(ActionCard(
                type="view_report",
                label="Lihat Dashboard",
                data={}
            ))

        return ChatResponse(
            reply=reply,
            suggested_actions=suggested_actions
        )

    except BadRequestError as e:
        error_msg = str(e)
        if "insufficient_quota" in error_msg.lower() or "billing" in error_msg.lower():
            raise HTTPException(
                status_code=402,
                detail="Spen AI membutuhkan top-up credit. Hubungi admin."
            )
        raise HTTPException(
            status_code=400,
            detail=f"Request tidak valid: {error_msg}"
        )
    except AuthenticationError:
        raise HTTPException(
            status_code=401,
            detail="API key Spen AI tidak valid. Hubungi admin."
        )
    except APIError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Gagal menghubungi Spen AI: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Terjadi kesalahan: {str(e)}"
        )
