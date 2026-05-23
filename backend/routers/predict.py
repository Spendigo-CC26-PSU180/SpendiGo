from typing import List
from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
import random

from core.deps import get_db, get_current_user
from models.user import User
from models.transaction import Transaction

router = APIRouter(prefix="/predict", tags=["predict"])


class CategoryPrediction(BaseModel):
    category: str
    predicted: int


class PredictionResponse(BaseModel):
    predicted_expense: int
    confidence: float
    based_on_months: int
    breakdown: List[CategoryPrediction]


class Insight(BaseModel):
    type: str  # warning, success, info
    message: str
    category: str | None = None
    change_percent: float | None = None


class InsightsResponse(BaseModel):
    insights: List[Insight]


class HealthScore(BaseModel):
    score: int
    label: str
    checks: List[dict]


@router.get("/next-month", response_model=PredictionResponse)
def predict_next_month(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Placeholder prediction endpoint - will be replaced with LSTM model.
    Currently uses simple average of last 3 months.
    """
    today = date.today()
    three_months_ago = today - timedelta(days=90)

    # Get category breakdown from last 3 months
    results = db.query(
        Transaction.category,
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= three_months_ago,
        Transaction.type == "expense"
    ).group_by(Transaction.category).all()

    if not results:
        # Return dummy data if no transactions
        return PredictionResponse(
            predicted_expense=1847000,
            confidence=0.5,
            based_on_months=0,
            breakdown=[
                CategoryPrediction(category="makan", predicted=650000),
                CategoryPrediction(category="transport", predicted=280000),
                CategoryPrediction(category="belanja online", predicted=420000),
                CategoryPrediction(category="kopi", predicted=247000),
                CategoryPrediction(category="hiburan", predicted=250000),
            ]
        )

    # Simple prediction: monthly average (total / 3)
    breakdown = []
    total_predicted = 0
    for r in results:
        monthly_avg = r.total // 3
        breakdown.append(CategoryPrediction(
            category=r.category,
            predicted=monthly_avg
        ))
        total_predicted += monthly_avg

    # Sort by predicted amount
    breakdown.sort(key=lambda x: x.predicted, reverse=True)

    # Confidence based on data availability (simple heuristic)
    transaction_count = db.query(func.count(Transaction.id)).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= three_months_ago,
        Transaction.type == "expense"
    ).scalar()

    confidence = min(0.95, 0.5 + (transaction_count / 200))

    return PredictionResponse(
        predicted_expense=total_predicted,
        confidence=round(confidence, 2),
        based_on_months=3,
        breakdown=breakdown[:7]  # Top 7 categories
    )


@router.get("/insights", response_model=InsightsResponse)
def get_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate spending insights based on transaction patterns.
    Placeholder - will be enhanced with ML insights.
    """
    today = date.today()
    this_month_start = date(today.year, today.month, 1)
    last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)
    last_month_end = this_month_start - timedelta(days=1)

    insights = []

    # Get this month's spending by category
    this_month = db.query(
        Transaction.category,
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= this_month_start,
        Transaction.type == "expense"
    ).group_by(Transaction.category).all()

    # Get last month's spending by category
    last_month = db.query(
        Transaction.category,
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= last_month_start,
        Transaction.date <= last_month_end,
        Transaction.type == "expense"
    ).group_by(Transaction.category).all()

    this_month_map = {r.category: r.total for r in this_month}
    last_month_map = {r.category: r.total for r in last_month}

    # Compare categories
    for category, this_total in this_month_map.items():
        last_total = last_month_map.get(category, 0)
        if last_total > 0:
            change = ((this_total - last_total) / last_total) * 100
            if change > 30:
                insights.append(Insight(
                    type="warning",
                    message=f"Pengeluaran {category} kamu naik {int(change)}% dari bulan lalu",
                    category=category,
                    change_percent=round(change, 1)
                ))
            elif change < -20:
                insights.append(Insight(
                    type="success",
                    message=f"Kamu berhasil hemat {abs(int(change))}% untuk {category}",
                    category=category,
                    change_percent=round(change, 1)
                ))

    # Total comparison
    this_total = sum(this_month_map.values())
    last_total = sum(last_month_map.values())
    if last_total > 0:
        total_change = ((this_total - last_total) / last_total) * 100
        if total_change < -10:
            insights.append(Insight(
                type="success",
                message=f"Total pengeluaran kamu turun {abs(int(total_change))}% dari bulan lalu!",
                change_percent=round(total_change, 1)
            ))
        elif total_change > 20:
            insights.append(Insight(
                type="warning",
                message=f"Total pengeluaran kamu naik {int(total_change)}% dari bulan lalu",
                change_percent=round(total_change, 1)
            ))

    # Add default insights if none found
    if not insights:
        insights.append(Insight(
            type="info",
            message="Terus catat transaksimu untuk mendapatkan insights yang lebih akurat!"
        ))

    return InsightsResponse(insights=insights)


@router.get("/health-score", response_model=HealthScore)
def get_health_score(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Calculate financial health score based on spending patterns.
    """
    today = date.today()
    this_month_start = date(today.year, today.month, 1)

    # Get income and expense for this month
    income = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= this_month_start,
        Transaction.type == "income"
    ).scalar()

    expense = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= this_month_start,
        Transaction.type == "expense"
    ).scalar()

    checks = []
    score = 50  # Base score

    # Check 1: Income vs Expense
    if income > expense:
        checks.append({"status": "good", "message": "Pengeluaran < Pemasukan"})
        score += 20
    elif income > 0:
        checks.append({"status": "warning", "message": "Pengeluaran > Pemasukan"})
        score -= 10
    else:
        checks.append({"status": "info", "message": "Belum ada data pemasukan"})

    # Check 2: Essential spending ratio (food + transport should be < 50%)
    essential_categories = ["makan", "transport", "kos/kontrakan", "tagihan"]
    essential_spending = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= this_month_start,
        Transaction.type == "expense",
        Transaction.category.in_(essential_categories)
    ).scalar()

    if expense > 0:
        essential_ratio = (essential_spending / expense) * 100
        if essential_ratio >= 50:
            checks.append({"status": "good", "message": "Pengeluaran primer terkontrol"})
            score += 15
        else:
            checks.append({"status": "warning", "message": "Pengeluaran non-primer cukup tinggi"})
            score += 5

    # Check 3: Transaction consistency
    transaction_count = db.query(func.count(Transaction.id)).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= this_month_start
    ).scalar()

    if transaction_count >= 15:
        checks.append({"status": "good", "message": "Rutin mencatat transaksi"})
        score += 15
    elif transaction_count >= 5:
        checks.append({"status": "info", "message": "Pencatatan cukup konsisten"})
        score += 10
    else:
        checks.append({"status": "warning", "message": "Perlu lebih sering mencatat"})

    # Clamp score
    score = max(0, min(100, score))

    # Determine label
    if score >= 80:
        label = "SANGAT BAIK"
    elif score >= 60:
        label = "BAIK"
    elif score >= 40:
        label = "CUKUP"
    else:
        label = "PERLU PERHATIAN"

    return HealthScore(score=score, label=label, checks=checks)
