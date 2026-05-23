from typing import Optional, List
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from pydantic import BaseModel

from core.deps import get_db, get_current_user
from models.user import User
from models.transaction import Transaction

router = APIRouter(prefix="/analytics", tags=["analytics"])


class SummaryResponse(BaseModel):
    total_income: int
    total_expense: int
    balance: int
    transaction_count: int
    avg_daily_expense: int


class CategorySummary(BaseModel):
    category: str
    total: int
    percentage: float
    count: int


class TrendData(BaseModel):
    date: date
    income: int
    expense: int
    balance: int


def parse_month(month_str: Optional[str]) -> tuple[date, date]:
    """Parse month string (YYYY-MM) to start and end dates"""
    if month_str:
        year, month = map(int, month_str.split("-"))
    else:
        today = date.today()
        year, month = today.year, today.month

    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)

    return start_date, end_date


@router.get("/summary", response_model=SummaryResponse)
def get_summary(
    month: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    start_date, end_date = parse_month(month)
    days_in_period = (end_date - start_date).days + 1

    base_query = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start_date,
        Transaction.date <= end_date
    )

    # Total income
    total_income = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.type == "income"
    ).scalar()

    # Total expense
    total_expense = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.type == "expense"
    ).scalar()

    # Transaction count
    transaction_count = base_query.count()

    # Average daily expense
    avg_daily_expense = total_expense // days_in_period if days_in_period > 0 else 0

    return SummaryResponse(
        total_income=total_income,
        total_expense=total_expense,
        balance=total_income - total_expense,
        transaction_count=transaction_count,
        avg_daily_expense=avg_daily_expense
    )


@router.get("/category", response_model=List[CategorySummary])
def get_category_summary(
    month: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}$"),
    type: str = Query("expense", pattern=r"^(income|expense)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    start_date, end_date = parse_month(month)

    # Get total for percentage calculation
    total = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.type == type
    ).scalar()

    if total == 0:
        return []

    # Get category breakdown
    results = db.query(
        Transaction.category,
        func.sum(Transaction.amount).label("total"),
        func.count(Transaction.id).label("count")
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.type == type
    ).group_by(Transaction.category).order_by(func.sum(Transaction.amount).desc()).all()

    return [
        CategorySummary(
            category=r.category,
            total=r.total,
            percentage=round((r.total / total) * 100, 1),
            count=r.count
        )
        for r in results
    ]


@router.get("/trend", response_model=List[TrendData])
def get_trend(
    days: int = Query(30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)

    # Get all transactions in the period
    transactions = db.query(
        Transaction.date,
        Transaction.type,
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start_date,
        Transaction.date <= end_date
    ).group_by(Transaction.date, Transaction.type).all()

    # Build a dict for easy lookup
    data_map = {}
    for t in transactions:
        if t.date not in data_map:
            data_map[t.date] = {"income": 0, "expense": 0}
        data_map[t.date][t.type] = t.total

    # Generate complete date range
    result = []
    current = start_date
    cumulative_balance = 0

    while current <= end_date:
        income = data_map.get(current, {}).get("income", 0)
        expense = data_map.get(current, {}).get("expense", 0)
        cumulative_balance += income - expense

        result.append(TrendData(
            date=current,
            income=income,
            expense=expense,
            balance=cumulative_balance
        ))
        current += timedelta(days=1)

    return result
