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


class SpendingDNAResponse(BaseModel):
    dna_type: str
    icon: str
    label: str
    description: str
    top_categories: List[dict]


class WeeklyWrappedResponse(BaseModel):
    total_spent: int
    vs_last_week: float
    busiest_day: str
    top_category: str
    top_category_amount: int
    insight: str


@router.get("/spending-dna", response_model=SpendingDNAResponse)
def get_spending_dna(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Analyze spending patterns and return a 'DNA type'"""
    # Get last 30 days of transactions
    end_date = date.today()
    start_date = end_date - timedelta(days=30)

    # Get total income and expense
    total_income = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.type == "income"
    ).scalar()

    total_expense = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.type == "expense"
    ).scalar()

    # Get category breakdown
    categories = db.query(
        Transaction.category,
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.type == "expense"
    ).group_by(Transaction.category).order_by(func.sum(Transaction.amount).desc()).limit(3).all()

    top_categories = [{"category": c.category, "amount": c.total} for c in categories]

    # Calculate spending ratio and variance
    spending_ratio = total_expense / total_income if total_income > 0 else 1

    # Get daily spending variance
    daily_expenses = db.query(
        Transaction.date,
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.type == "expense"
    ).group_by(Transaction.date).all()

    daily_amounts = [d.total for d in daily_expenses]
    variance = 0
    if len(daily_amounts) > 1:
        mean = sum(daily_amounts) / len(daily_amounts)
        variance = sum((x - mean) ** 2 for x in daily_amounts) / len(daily_amounts)
        variance = (variance ** 0.5) / mean if mean > 0 else 0  # Coefficient of variation

    # Determine DNA type
    if spending_ratio > 0.9:
        dna_type = "hedonist"
        icon = "🎉"
        label = "Si Hedonist"
        description = "Kamu suka menikmati hidup! Tapi hati-hati, jangan sampai kantong jebol ya."
    elif spending_ratio < 0.5:
        dna_type = "saver"
        icon = "🐿️"
        label = "Si Penabung"
        description = "Kamu jago banget nabung! Tapi sesekali treat yourself juga boleh kok."
    elif variance > 0.8:
        dna_type = "unpredictable"
        icon = "🎲"
        label = "Si Unpredictable"
        description = "Pengeluaranmu naik turun kayak roller coaster. Coba lebih konsisten ya!"
    else:
        dna_type = "balanced"
        icon = "⚖️"
        label = "Si Seimbang"
        description = "Balance is the key! Kamu udah bagus ngatur keuangan."

    return SpendingDNAResponse(
        dna_type=dna_type,
        icon=icon,
        label=label,
        description=description,
        top_categories=top_categories
    )


@router.get("/weekly-wrapped", response_model=WeeklyWrappedResponse)
def get_weekly_wrapped(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get weekly spending summary"""
    today = date.today()
    # This week (Monday to today)
    days_since_monday = today.weekday()
    week_start = today - timedelta(days=days_since_monday)

    # Last week
    last_week_end = week_start - timedelta(days=1)
    last_week_start = last_week_end - timedelta(days=6)

    # This week's total
    this_week_total = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= week_start,
        Transaction.date <= today,
        Transaction.type == "expense"
    ).scalar()

    # Last week's total
    last_week_total = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= last_week_start,
        Transaction.date <= last_week_end,
        Transaction.type == "expense"
    ).scalar()

    # Percentage change
    if last_week_total > 0:
        vs_last_week = round(((this_week_total - last_week_total) / last_week_total) * 100, 1)
    else:
        vs_last_week = 0 if this_week_total == 0 else 100

    # Busiest day
    day_names = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
    busiest = db.query(
        func.extract('dow', Transaction.date).label("day_of_week"),
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= week_start,
        Transaction.date <= today,
        Transaction.type == "expense"
    ).group_by(func.extract('dow', Transaction.date)).order_by(func.sum(Transaction.amount).desc()).first()

    if busiest:
        # PostgreSQL dow: 0=Sunday, 1=Monday, etc. Convert to Python weekday
        dow = int(busiest.day_of_week)
        py_weekday = (dow - 1) % 7  # Convert to Monday=0
        busiest_day = day_names[py_weekday]
    else:
        busiest_day = "-"

    # Top category
    top_cat = db.query(
        Transaction.category,
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= week_start,
        Transaction.date <= today,
        Transaction.type == "expense"
    ).group_by(Transaction.category).order_by(func.sum(Transaction.amount).desc()).first()

    top_category = top_cat.category if top_cat else "-"
    top_category_amount = top_cat.total if top_cat else 0

    # Generate insight
    if vs_last_week > 20:
        insight = f"Minggu ini kamu lebih boros {abs(vs_last_week):.0f}% dari minggu lalu!"
    elif vs_last_week < -20:
        insight = f"Mantap! Kamu hemat {abs(vs_last_week):.0f}% dari minggu lalu!"
    else:
        insight = "Pengeluaranmu minggu ini cukup stabil."

    return WeeklyWrappedResponse(
        total_spent=this_week_total,
        vs_last_week=vs_last_week,
        busiest_day=busiest_day,
        top_category=top_category,
        top_category_amount=top_category_amount,
        insight=insight
    )


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
