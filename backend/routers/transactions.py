from typing import Optional
from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
import math

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
