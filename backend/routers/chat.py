from typing import List, Optional
from datetime import date, timedelta
import json
import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from openai import OpenAI, APIError, AuthenticationError, BadRequestError
from dateutil.relativedelta import relativedelta

from core.deps import get_db, get_current_user
from core.config import get_settings
from models.user import User
from models.transaction import Transaction

router = APIRouter(prefix="/chat", tags=["chat"])

settings = get_settings()

# Valid categories
EXPENSE_CATEGORIES = ["makan", "transport", "belanja online", "kopi", "hiburan", "tagihan", "kos/kontrakan", "kesehatan", "pendidikan", "investasi", "lainnya"]
INCOME_CATEGORIES = ["gaji", "freelance", "bonus", "hadiah", "investasi", "lainnya"]

# Intent categories for lazy context injection
INTENTS = {
    "basic": ["halo", "hai", "hi", "hey", "apa kabar", "siapa kamu", "help", "bantuan"],
    "category": ["kategori", "pengeluaran", "spending", "habis", "boros", "hemat", "makan", "kopi", "transport", "belanja", "tagihan"],
    "prediction": ["prediksi", "forecast", "bulan depan", "perkiraan", "estimasi", "akan"],
    "broke": ["bokek", "habis", "cukup", "sampai kapan", "tanggal berapa", "broke"],
    "transaction": ["catat", "simpan", "beli", "bayar", "gaji", "dapat", "terima", "belanja", "ongkos", "naik", "jajan", "investasi", "invest", "saham", "reksadana", "crypto"],
    "advice": ["tips", "saran", "gimana", "bagaimana", "cara", "strategi", "rekomendasi"],
}

# Non-financial keywords for hard gate
NON_FINANCIAL_KEYWORDS = [
    "resep", "masak", "cuaca", "weather", "politik", "berita", "news",
    "film", "movie", "musik", "lagu", "game", "main", "pacaran", "cinta",
    "coding", "program", "code", "debug", "error", "bug",
    "sejarah", "history", "geografi", "fisika", "kimia", "biologi",
    "cerita", "dongeng", "puisi", "joke", "lelucon", "lucu",
]


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


# ==================================================
# INTENT CLASSIFICATION
# ==================================================

def classify_intent(message: str) -> List[str]:
    """
    Classify user message into one or more intents.
    Returns list of relevant intents for lazy context injection.
    """
    message_lower = message.lower()
    detected_intents = []

    for intent, keywords in INTENTS.items():
        if any(kw in message_lower for kw in keywords):
            detected_intents.append(intent)

    # Default to basic if no specific intent detected
    if not detected_intents:
        detected_intents = ["basic"]

    return detected_intents


def is_non_financial_question(message: str) -> bool:
    """
    Check if the message is clearly non-financial.
    Returns True if should be rejected with polite redirect.
    """
    message_lower = message.lower()

    # Count financial vs non-financial keywords
    financial_score = 0
    non_financial_score = 0

    # Check financial keywords
    all_financial_keywords = []
    for keywords in INTENTS.values():
        all_financial_keywords.extend(keywords)
    all_financial_keywords.extend(["uang", "rupiah", "duit", "saldo", "balance", "budget", "anggaran"])

    for kw in all_financial_keywords:
        if kw in message_lower:
            financial_score += 1

    # Check non-financial keywords
    for kw in NON_FINANCIAL_KEYWORDS:
        if kw in message_lower:
            non_financial_score += 1

    # Only reject if clearly non-financial and no financial context
    return non_financial_score > 0 and financial_score == 0


# ==================================================
# CONTEXT BUILDERS (Lazy Loading)
# ==================================================

def build_basic_context(db: Session, user: User) -> str:
    """Build minimal context for basic queries - includes ALL-TIME data."""
    today = date.today()
    this_month_start = date(today.year, today.month, 1)

    # ALL-TIME totals for accurate balance
    all_time_income = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == user.id,
        Transaction.type == "income"
    ).scalar()

    all_time_expense = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == user.id,
        Transaction.type == "expense"
    ).scalar()

    total_balance = all_time_income - all_time_expense

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

    # Get date range of user's transactions
    first_transaction = db.query(func.min(Transaction.date)).filter(
        Transaction.user_id == user.id
    ).scalar()

    last_transaction = db.query(func.max(Transaction.date)).filter(
        Transaction.user_id == user.id
    ).scalar()

    date_range = ""
    if first_transaction and last_transaction:
        date_range = f"\n- Data tersedia: {first_transaction.strftime('%d %b %Y')} - {last_transaction.strftime('%d %b %Y')}"

    return f"""Data Ringkas:
- Total Saldo (semua waktu): Rp {total_balance:,}
- Total Pemasukan: Rp {all_time_income:,}
- Total Pengeluaran: Rp {all_time_expense:,}{date_range}
- Pemasukan bulan ini: Rp {this_month_income:,}
- Pengeluaran bulan ini: Rp {this_month_expense:,}"""


def build_category_context(db: Session, user: User) -> str:
    """Build category breakdown context - includes ALL available data."""
    today = date.today()
    this_month_start = date(today.year, today.month, 1)

    # ALL-TIME category breakdown (for users with historical data)
    all_time_cats = db.query(
        Transaction.category,
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.user_id == user.id,
        Transaction.type == "expense"
    ).group_by(Transaction.category).order_by(func.sum(Transaction.amount).desc()).limit(7).all()

    # This month by category
    this_month_cats = db.query(
        Transaction.category,
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.user_id == user.id,
        Transaction.date >= this_month_start,
        Transaction.type == "expense"
    ).group_by(Transaction.category).order_by(func.sum(Transaction.amount).desc()).limit(5).all()

    # Recent transactions (last 10) for context
    recent_transactions = db.query(Transaction).filter(
        Transaction.user_id == user.id,
        Transaction.type == "expense"
    ).order_by(Transaction.date.desc()).limit(10).all()

    context = ""

    # Show all-time breakdown first (most useful)
    if all_time_cats:
        context += "\nTotal Pengeluaran per Kategori (Semua Waktu):\n"
        for cat in all_time_cats:
            context += f"- {cat.category}: Rp {cat.total:,}\n"

    # Show this month only if there's data
    if this_month_cats:
        context += "\nBulan Ini:\n"
        for cat in this_month_cats:
            context += f"- {cat.category}: Rp {cat.total:,}\n"

    # Show recent transactions for context
    if recent_transactions:
        context += "\nTransaksi Terakhir:\n"
        for t in recent_transactions[:5]:
            context += f"- {t.date.strftime('%d/%m')}: {t.category} Rp {t.amount:,} ({t.description or '-'})\n"

    return context


def build_prediction_context(db: Session, user: User) -> str:
    """Build prediction-related context - all available monthly data."""
    # Get ALL monthly data for trend analysis
    monthly_totals = db.query(
        func.strftime('%Y-%m', Transaction.date).label('month'),
        func.sum(Transaction.amount).label('total')
    ).filter(
        Transaction.user_id == user.id,
        Transaction.type == "expense"
    ).group_by(func.strftime('%Y-%m', Transaction.date)).order_by('month').all()

    if not monthly_totals:
        return "\nBelum ada data transaksi untuk analisis trend."

    context = "\nTrend Pengeluaran Bulanan:\n"
    for row in monthly_totals:
        context += f"- {row.month}: Rp {row.total:,}\n"

    # Add average
    avg = sum(r.total for r in monthly_totals) / len(monthly_totals)
    context += f"\nRata-rata: Rp {avg:,.0f}/bulan ({len(monthly_totals)} bulan data)"

    return context


def build_broke_context(db: Session, user: User) -> str:
    """Build broke-date related context."""
    today = date.today()
    thirty_days_ago = today - relativedelta(days=30)

    # Current balance (all time)
    all_transactions = db.query(Transaction).filter(
        Transaction.user_id == user.id
    ).all()

    total_income = sum(t.amount for t in all_transactions if t.type == 'income')
    total_expense = sum(t.amount for t in all_transactions if t.type == 'expense')
    current_balance = total_income - total_expense

    # Average daily expense
    recent_expenses = [t for t in all_transactions if t.type == 'expense' and t.date >= thirty_days_ago]
    total_recent_expense = sum(t.amount for t in recent_expenses)
    avg_daily = total_recent_expense / 30 if total_recent_expense > 0 else 0

    days_remaining = int(current_balance / avg_daily) if avg_daily > 0 and current_balance > 0 else 0

    return f"""Data Saldo:
- Saldo saat ini: Rp {current_balance:,}
- Pengeluaran rata-rata/hari: Rp {avg_daily:,.0f}
- Estimasi cukup untuk: {days_remaining} hari"""


def build_transaction_context(db: Session, user: User) -> str:
    """Build recent transaction context."""
    recent_transactions = db.query(Transaction).filter(
        Transaction.user_id == user.id
    ).order_by(Transaction.date.desc()).limit(5).all()

    context = "\nTransaksi Terakhir:\n"
    for tx in recent_transactions:
        context += f"- {tx.date}: {tx.category} Rp {tx.amount:,} ({tx.type})\n"

    return context


# ==================================================
# SYSTEM PROMPT BUILDER
# ==================================================

def build_system_prompt(intents: List[str], db: Session, user: User) -> str:
    """
    Build system prompt with lazy context injection.
    Only includes context relevant to detected intents.
    Saves 40-60% tokens compared to full context.
    """
    base_prompt = """Kamu adalah Spen, AI financial assistant untuk aplikasi SpendiGo.

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
- Hanya jawab pertanyaan terkait keuangan pribadi
"""

    # Build context based on intents
    context_parts = []

    if "basic" in intents or "advice" in intents:
        context_parts.append(build_basic_context(db, user))

    if "category" in intents or "advice" in intents:
        context_parts.append(build_category_context(db, user))

    if "prediction" in intents:
        context_parts.append(build_prediction_context(db, user))

    if "broke" in intents:
        context_parts.append(build_broke_context(db, user))

    if "transaction" in intents:
        context_parts.append(build_transaction_context(db, user))

    # Combine
    if context_parts:
        full_context = "\n".join(context_parts)
        return f"{base_prompt}\n\n{full_context}\n\nBerdasarkan data di atas, berikan advice yang personalized."

    return base_prompt


# ==================================================
# TRANSACTION PARSER
# ==================================================

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


# ==================================================
# MAIN CHAT ENDPOINT
# ==================================================

@router.post("", response_model=ChatResponse)
def chat_with_spen(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Chat with Spen AI assistant with lazy context injection."""

    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Spen AI belum dikonfigurasi. Hubungi admin."
        )

    # Hard gate for non-financial questions
    if is_non_financial_question(request.message):
        return ChatResponse(
            reply="Hmm, aku Spen, asisten keuangan kamu. Aku cuma bisa bantu soal keuangan ya! Ada yang mau ditanya soal pengeluaran, budget, atau tips nabung? 💰",
            suggested_actions=[]
        )

    # Classify intent for lazy context injection
    intents = classify_intent(request.message)

    # Build system prompt with only relevant context
    system_prompt = build_system_prompt(intents, db, current_user)

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
        if "transaction" in intents:
            amount_pattern = r'\d+[,.]?\d*\s*(rb|ribu|k|jt|juta)?|\d{4,}'
            if re.search(amount_pattern, message_lower, re.IGNORECASE):
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

        # Check if user asks about predictions
        if "prediction" in intents:
            suggested_actions.append(ActionCard(
                type="view_predictions",
                label="Lihat Prediksi",
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
