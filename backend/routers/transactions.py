from typing import Optional, List
from datetime import date, datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
import math
import csv
import io

from core.deps import get_db, get_current_user
from models.user import User
from models.transaction import Transaction
from schemas.transaction import (
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
    TransactionListResponse,
    EXPENSE_CATEGORIES,
    INCOME_CATEGORIES
)

router = APIRouter(prefix="/transactions", tags=["transactions"])


class ImportResult(BaseModel):
    success: bool
    total_rows: int
    imported: int
    failed: int
    errors: List[dict]


def validate_category(type: str, category: str) -> bool:
    if type == "expense":
        return category.lower() in EXPENSE_CATEGORIES
    elif type == "income":
        return category.lower() in INCOME_CATEGORIES
    return False


@router.get("", response_model=TransactionListResponse)
def get_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    type: Optional[str] = None,
    category: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    if type:
        query = query.filter(Transaction.type == type)
    if category:
        query = query.filter(Transaction.category == category.lower())
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)

    total = query.count()
    total_pages = math.ceil(total / limit) if total > 0 else 1

    transactions = (
        query
        .order_by(desc(Transaction.date), desc(Transaction.created_at))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return TransactionListResponse(
        data=[TransactionResponse.model_validate(t) for t in transactions],
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages
    )


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    transaction_data: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not validate_category(transaction_data.type, transaction_data.category):
        valid_categories = EXPENSE_CATEGORIES if transaction_data.type == "expense" else INCOME_CATEGORIES
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Kategori tidak valid untuk {transaction_data.type}. Pilihan: {', '.join(valid_categories)}"
        )

    transaction = Transaction(
        user_id=current_user.id,
        date=transaction_data.date,
        amount=transaction_data.amount,
        type=transaction_data.type,
        category=transaction_data.category.lower(),
        description=transaction_data.description
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    return TransactionResponse.model_validate(transaction)


@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: UUID,
    transaction_data: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    transaction = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .first()
    )

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaksi tidak ditemukan"
        )

    update_data = transaction_data.model_dump(exclude_unset=True)

    # Validate category if type or category is being updated
    new_type = update_data.get("type", transaction.type)
    new_category = update_data.get("category", transaction.category)
    if "type" in update_data or "category" in update_data:
        if not validate_category(new_type, new_category):
            valid_categories = EXPENSE_CATEGORIES if new_type == "expense" else INCOME_CATEGORIES
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Kategori tidak valid untuk {new_type}. Pilihan: {', '.join(valid_categories)}"
            )

    for key, value in update_data.items():
        if key == "category" and value:
            value = value.lower()
        setattr(transaction, key, value)

    db.commit()
    db.refresh(transaction)

    return TransactionResponse.model_validate(transaction)


@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    transaction = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .first()
    )

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaksi tidak ditemukan"
        )

    db.delete(transaction)
    db.commit()

    return {"message": "deleted"}


@router.post("/import", response_model=ImportResult)
async def import_transactions(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import transactions from CSV file.

    Expected CSV format:
    date,amount,type,category,description
    2026-01-15,50000,expense,makan,Makan siang
    2026-01-16,2000000,income,gaji,Gaji bulanan

    - date: YYYY-MM-DD format
    - amount: positive integer
    - type: 'income' or 'expense'
    - category: valid category for the type
    - description: optional
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File harus berformat CSV"
        )

    try:
        content = await file.read()
        # Try to decode with utf-8-sig (handles BOM), fallback to utf-8, then latin-1
        try:
            text = content.decode('utf-8-sig')  # Handles BOM
        except UnicodeDecodeError:
            try:
                text = content.decode('utf-8')
            except UnicodeDecodeError:
                text = content.decode('latin-1')

        # Parse CSV
        reader = csv.DictReader(io.StringIO(text))

        imported = 0
        failed = 0
        errors = []
        rows = list(reader)

        # Normalize column names (lowercase, strip whitespace)
        if rows:
            normalized_rows = []
            for row in rows:
                normalized_row = {k.lower().strip(): v for k, v in row.items() if k}
                normalized_rows.append(normalized_row)
            rows = normalized_rows

        for i, row in enumerate(rows, start=2):  # Start at 2 because row 1 is header
            try:
                # Parse and validate date
                date_str = row.get('date', row.get('tanggal', '')).strip()
                if not date_str:
                    raise ValueError("Tanggal kosong")

                # Support multiple date formats
                parsed_date = None
                for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%Y/%m/%d']:
                    try:
                        parsed_date = datetime.strptime(date_str, fmt).date()
                        break
                    except ValueError:
                        continue

                if not parsed_date:
                    raise ValueError(f"Format tanggal tidak valid: {date_str}")

                # Parse amount
                amount_str = row.get('amount', '').strip().replace('.', '').replace(',', '')
                if not amount_str:
                    raise ValueError("Amount kosong")
                amount = int(amount_str)
                if amount <= 0:
                    raise ValueError("Amount harus positif")

                # Parse type
                tx_type = row.get('type', '').strip().lower()
                if tx_type not in ['income', 'expense']:
                    raise ValueError(f"Type harus 'income' atau 'expense', got: {tx_type}")

                # Parse category
                category = row.get('category', '').strip().lower()
                if not category:
                    raise ValueError("Category kosong")

                if not validate_category(tx_type, category):
                    valid_cats = EXPENSE_CATEGORIES if tx_type == "expense" else INCOME_CATEGORIES
                    raise ValueError(f"Category '{category}' tidak valid untuk {tx_type}. Pilihan: {', '.join(valid_cats)}")

                # Parse description (optional)
                description = row.get('description', '').strip() or None

                # Create transaction
                transaction = Transaction(
                    user_id=current_user.id,
                    date=parsed_date,
                    amount=amount,
                    type=tx_type,
                    category=category,
                    description=description
                )
                db.add(transaction)
                imported += 1

            except Exception as e:
                failed += 1
                errors.append({
                    "row": i,
                    "data": dict(row),
                    "error": str(e)
                })

        # Commit all successful transactions
        if imported > 0:
            db.commit()

        return ImportResult(
            success=failed == 0,
            total_rows=len(rows),
            imported=imported,
            failed=failed,
            errors=errors[:10]  # Limit to first 10 errors
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal memproses file: {str(e)}"
        )
