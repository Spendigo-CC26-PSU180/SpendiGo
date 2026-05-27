from typing import List, Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from dateutil.relativedelta import relativedelta
import pandas as pd
import numpy as np

from core.deps import get_db, get_current_user
from models.user import User
from models.transaction import Transaction
from ml.model_loader import get_model, get_scaler, get_scaler_target, INPUT_COLS, LOOKBACK

router = APIRouter(prefix="/predict", tags=["predict"])


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


# ==================================================
# Response Models
# ==================================================

class CategoryPrediction(BaseModel):
    category: str
    predicted: int
    percentage: float


class PredictionResponse(BaseModel):
    has_prediction: bool
    months_available: int
    months_needed: int = LOOKBACK
    predicted_expense: int | None
    last_month_expense: int | None = None
    change_percentage: float | None = None
    change_direction: str | None = None
    confidence: str | None = None
    confidence_percentage: int | None = None
    breakdown: List[CategoryPrediction]
    message: str


class BrokeDateResponse(BaseModel):
    has_prediction: bool
    current_balance: int | None = None
    avg_daily_expense: int | None = None
    days_remaining: int | None = None
    predicted_broke_date: str | None = None
    predicted_broke_date_formatted: str | None = None
    warning_level: str | None = None  # "danger" | "warning" | "safe"
    tips: List[str] = []
    message: str


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


class ModelStatusResponse(BaseModel):
    model_loaded: bool
    lookback_required: int
    months_available: int
    ready_for_prediction: bool
    model_performance: dict


class MonthPrediction(BaseModel):
    month: str  # "2026-06"
    month_label: str  # "Juni 2026"
    predicted_expense: int
    confidence_percentage: int


class ThreeMonthResponse(BaseModel):
    has_prediction: bool
    months_available: int
    predictions: List[MonthPrediction]
    total_predicted: int | None = None
    average_predicted: int | None = None
    trend: str | None = None  # "increasing" | "decreasing" | "stable"
    message: str


class WhatIfRequest(BaseModel):
    income_change: float = 0  # percentage change, e.g., -20 for 20% less income
    expense_category_changes: dict = {}  # {"makan": -30, "kopi": -50} percentage changes
    add_monthly_expense: int = 0  # flat additional expense, e.g., new kos


class WhatIfResponse(BaseModel):
    has_prediction: bool
    baseline_expense: int | None = None
    simulated_expense: int | None = None
    difference: int | None = None
    difference_percentage: float | None = None
    baseline_broke_days: int | None = None
    simulated_broke_days: int | None = None
    broke_days_difference: int | None = None
    insights: List[str] = []
    message: str


# ==================================================
# HELPER - Agregasi transaksi bulanan dari DB
# ==================================================

def get_monthly_aggregates(user_id, db: Session, months: int = 6) -> pd.DataFrame:
    """
    Ambil dan agregasi transaksi user ke format bulanan.
    Return DataFrame dengan kolom sesuai INPUT_COLS.
    """
    today = date.today()
    start_date = (today.replace(day=1) - relativedelta(months=months)).replace(day=1)

    # Query semua transaksi dalam rentang (include bulan berjalan)
    transactions = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.date >= start_date,
        Transaction.date <= today
    ).all()

    if not transactions:
        return pd.DataFrame()

    # Convert ke DataFrame
    df = pd.DataFrame([{
        'date': t.date,
        'amount': t.amount,
        'type': t.type,
        'category': t.category,
    } for t in transactions])

    df['date'] = pd.to_datetime(df['date'])
    df['year'] = df['date'].dt.year
    df['month'] = df['date'].dt.month

    # Agregasi per bulan
    monthly_rows = []

    for (year, month), group in df.groupby(['year', 'month']):
        expense_rows = group[group['type'] == 'expense']
        income_rows = group[group['type'] == 'income']

        total_expense = expense_rows['amount'].sum() if len(expense_rows) > 0 else 0
        total_income = income_rows['amount'].sum() if len(income_rows) > 0 else 0
        frekuensi_exp = len(expense_rows)
        frekuensi_inc = len(income_rows)
        avg_expense = expense_rows['amount'].mean() if len(expense_rows) > 0 else 0
        max_expense = expense_rows['amount'].max() if len(expense_rows) > 0 else 0
        net = total_income - total_expense

        # Skip bulan tanpa expense sama sekali
        if total_expense <= 0:
            continue

        monthly_rows.append({
            'year': year,
            'month': month,
            'total_expense': total_expense,
            'total_income': total_income,
            'net': net,
            'frekuensi_exp': frekuensi_exp,
            'frekuensi_inc': frekuensi_inc,
            'avg_expense': avg_expense,
            'max_expense': max_expense,
        })

    if not monthly_rows:
        return pd.DataFrame()

    result = pd.DataFrame(monthly_rows)
    result = result.sort_values(['year', 'month']).reset_index(drop=True)
    return result


def has_enough_data(monthly_df: pd.DataFrame) -> bool:
    """Cek apakah user punya cukup data untuk prediksi (minimal LOOKBACK bulan)."""
    return len(monthly_df) >= LOOKBACK


# ==================================================
# ENDPOINT 1 - Prediksi Pengeluaran Bulan Depan
# ==================================================

@router.get("/next-month", response_model=PredictionResponse)
def predict_next_month(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Prediksi total pengeluaran bulan depan menggunakan model LSTM.
    Membutuhkan minimal 2 bulan data historis user.
    """
    user_id = current_user.id

    # Ambil data bulanan (12 bulan terakhir)
    monthly_df = get_monthly_aggregates(user_id, db, months=12)
    months_available = len(monthly_df)

    # Cek data cukup
    if not has_enough_data(monthly_df):
        return PredictionResponse(
            has_prediction=False,
            months_available=months_available,
            months_needed=LOOKBACK,
            predicted_expense=None,
            breakdown=[],
            message=f"Kamu baru punya data {months_available} bulan. Butuh minimal {LOOKBACK} bulan untuk prediksi."
        )

    try:
        model = get_model()
        scaler = get_scaler()
        scaler_target = get_scaler_target()
    except Exception as e:
        # ML model not available - return graceful response
        return PredictionResponse(
            has_prediction=False,
            months_available=months_available,
            months_needed=LOOKBACK,
            predicted_expense=None,
            breakdown=[],
            message=f"Fitur prediksi sedang tidak tersedia. Silakan coba lagi nanti."
        )

    try:
        # Ambil 2 bulan terakhir
        last_n = monthly_df.tail(LOOKBACK)

        # Scale input
        X_scaled = scaler.transform(last_n[INPUT_COLS])  # shape: (2, 7)
        X_input = X_scaled.reshape(1, LOOKBACK, len(INPUT_COLS))  # shape: (1, 2, 7)

        # Predict
        pred_scaled = model.predict(X_input, verbose=0)  # shape: (1, 1)

        # Inverse transform ke Rupiah
        pred_rp = float(scaler_target.inverse_transform(
            pred_scaled.reshape(-1, 1)
        )[0][0])

        # Hitung confidence berdasarkan konsistensi data
        if months_available >= 6:
            confidence = "high"
            confidence_pct = 87
        elif months_available >= 4:
            confidence = "medium"
            confidence_pct = 72
        else:
            confidence = "low"
            confidence_pct = 58

        # Breakdown prediksi per kategori berdasarkan proporsi 2 bulan terakhir
        two_months_ago = date.today().replace(day=1) - relativedelta(months=2)
        recent_transactions = db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.type == 'expense',
            Transaction.date >= two_months_ago
        ).all()

        category_totals = {}
        for t in recent_transactions:
            category_totals[t.category] = category_totals.get(t.category, 0) + t.amount

        total_recent = sum(category_totals.values())
        breakdown = []
        if total_recent > 0:
            for cat, amount in sorted(category_totals.items(), key=lambda x: x[1], reverse=True)[:5]:
                proportion = amount / total_recent
                predicted_cat = pred_rp * proportion
                breakdown.append(CategoryPrediction(
                    category=cat,
                    predicted=round(predicted_cat),
                    percentage=round(proportion * 100, 1)
                ))

        # Hitung perubahan vs bulan lalu
        last_month_expense = float(monthly_df.iloc[-1]['total_expense'])
        change_pct = ((pred_rp - last_month_expense) / last_month_expense * 100) if last_month_expense > 0 else 0

        return PredictionResponse(
            has_prediction=True,
            months_available=months_available,
            predicted_expense=round(pred_rp),
            last_month_expense=round(last_month_expense),
            change_percentage=round(change_pct, 1),
            change_direction="up" if change_pct > 0 else "down",
            confidence=confidence,
            confidence_percentage=confidence_pct,
            breakdown=breakdown,
            message=f"Berdasarkan {months_available} bulan data kamu"
        )

    except Exception as e:
        # Prediction failed - return graceful response with error details
        import traceback
        print(f"Prediction error: {e}")
        print(traceback.format_exc())
        return PredictionResponse(
            has_prediction=False,
            months_available=months_available,
            months_needed=LOOKBACK,
            predicted_expense=None,
            breakdown=[],
            message=f"Prediksi error: {str(e)}"
        )


# ==================================================
# ENDPOINT 2 - Prediksi Kapan Bokek
# ==================================================

@router.get("/broke-date", response_model=BrokeDateResponse)
def predict_broke_date(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Prediksi tanggal uang habis berdasarkan saldo saat ini
    dan rata-rata pengeluaran harian 30 hari terakhir.
    """
    user_id = current_user.id
    today = date.today()
    thirty_days_ago = today - relativedelta(days=30)

    # Ambil semua transaksi 30 hari terakhir
    recent_transactions = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.date >= thirty_days_ago
    ).all()

    if not recent_transactions:
        return BrokeDateResponse(
            has_prediction=False,
            message="Belum cukup data untuk prediksi. Mulai catat transaksi kamu!"
        )

    # Hitung saldo saat ini (semua waktu)
    all_transactions = db.query(Transaction).filter(
        Transaction.user_id == user_id
    ).all()

    total_income = sum(t.amount for t in all_transactions if t.type == 'income')
    total_expense = sum(t.amount for t in all_transactions if t.type == 'expense')
    current_balance = total_income - total_expense

    # Hitung rata-rata pengeluaran harian (30 hari terakhir)
    daily_expenses = {}
    for t in recent_transactions:
        if t.type == 'expense':
            date_key = t.date.isoformat()
            daily_expenses[date_key] = daily_expenses.get(date_key, 0) + t.amount

    if not daily_expenses:
        return BrokeDateResponse(
            has_prediction=False,
            message="Belum ada data pengeluaran 30 hari terakhir."
        )

    avg_daily_expense = sum(daily_expenses.values()) / 30  # dibagi 30, bukan jumlah hari aktif

    # Prediksi hari sampai bokek
    if avg_daily_expense <= 0:
        return BrokeDateResponse(
            has_prediction=False,
            message="Data pengeluaran tidak valid."
        )

    days_remaining = int(current_balance / avg_daily_expense) if current_balance > 0 else 0
    predicted_broke_date = today + relativedelta(days=days_remaining)

    # Warning level
    if days_remaining < 7:
        warning_level = "danger"
    elif days_remaining < 14:
        warning_level = "warning"
    else:
        warning_level = "safe"

    # Tips berdasarkan kategori terbesar
    category_totals = {}
    for t in recent_transactions:
        if t.type == 'expense':
            category_totals[t.category] = category_totals.get(t.category, 0) + t.amount

    top_categories = sorted(category_totals.items(), key=lambda x: x[1], reverse=True)[:2]

    tips_map = {
        "makan": "Coba masak sendiri beberapa kali seminggu",
        "kopi": "Kurangi frekuensi beli kopi di luar",
        "belanja online": "Tahan dulu belanja online sampai gajian",
        "transport": "Coba jalan kaki atau naik angkot untuk jarak dekat",
        "hiburan": "Cari hiburan gratis dulu minggu ini",
        "fashion": "Skip belanja baju dulu bulan ini",
        "nongkrong": "Kurangi frekuensi nongkrong minggu ini",
        "investasi": "Bagus! Investasi penting, tapi pastikan kebutuhan pokok terpenuhi dulu",
    }

    tips = []
    for cat, _ in top_categories:
        tip = tips_map.get(cat, f"Kurangi pengeluaran {cat} minggu ini")
        tips.append(tip)

    if not tips:
        tips = ["Catat semua pengeluaran kamu agar lebih terkontrol"]

    return BrokeDateResponse(
        has_prediction=True,
        current_balance=round(current_balance),
        avg_daily_expense=round(avg_daily_expense),
        days_remaining=days_remaining,
        predicted_broke_date=predicted_broke_date.isoformat(),
        predicted_broke_date_formatted=predicted_broke_date.strftime("%d %B %Y"),
        warning_level=warning_level,
        tips=tips,
        message=f"Dengan pengeluaran rata-rata Rp {avg_daily_expense:,.0f}/hari"
    )


# ==================================================
# ENDPOINT 3 - Model Status
# ==================================================

@router.get("/status", response_model=ModelStatusResponse)
def model_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cek status model dan berapa bulan data yang dimiliki user."""
    user_id = current_user.id

    monthly_df = get_monthly_aggregates(user_id, db, months=12)
    months_available = len(monthly_df)

    # Check if model is loadable
    model_loaded = False
    model_error = None
    try:
        get_model()
        get_scaler()
        get_scaler_target()
        model_loaded = True
    except Exception as e:
        model_error = str(e)

    return ModelStatusResponse(
        model_loaded=model_loaded,
        lookback_required=LOOKBACK,
        months_available=months_available,
        ready_for_prediction=model_loaded and months_available >= LOOKBACK,
        model_performance={
            "mae_rupiah": 278601,
            "rmse_rupiah": 377230,
            "smape_pct": 18.41,
            "status": "LULUS" if model_loaded else f"NOT_LOADED: {model_error}"
        }
    )


# ==================================================
# DEBUG ENDPOINT - Check user data for prediction
# ==================================================

@router.get("/debug-data")
def debug_prediction_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Debug endpoint to check user's data for prediction."""
    user_id = current_user.id
    today = date.today()

    # Get all transactions
    all_transactions = db.query(Transaction).filter(
        Transaction.user_id == user_id
    ).all()

    # Group by month
    monthly_summary = {}
    for t in all_transactions:
        month_key = f"{t.date.year}-{t.date.month:02d}"
        if month_key not in monthly_summary:
            monthly_summary[month_key] = {"income": 0, "expense": 0, "count": 0}
        if t.type == "income":
            monthly_summary[month_key]["income"] += t.amount
        else:
            monthly_summary[month_key]["expense"] += t.amount
        monthly_summary[month_key]["count"] += 1

    # Get aggregated data
    monthly_df = get_monthly_aggregates(user_id, db, months=12)

    return {
        "today": today.isoformat(),
        "total_transactions": len(all_transactions),
        "monthly_summary": monthly_summary,
        "aggregated_months": len(monthly_df),
        "aggregated_data": monthly_df.to_dict('records') if len(monthly_df) > 0 else [],
        "lookback_required": LOOKBACK,
        "ready_for_prediction": len(monthly_df) >= LOOKBACK
    }


# ==================================================
# ENDPOINT 4 - Insights (existing, kept for compatibility)
# ==================================================

@router.get("/insights", response_model=InsightsResponse)
def get_insights(
    month: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate spending insights based on transaction patterns."""
    this_month_start, this_month_end = parse_month(month)
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
        Transaction.date <= this_month_end,
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


# ==================================================
# ENDPOINT 5 - Health Score (existing, kept for compatibility)
# ==================================================

# ==================================================
# ENDPOINT 6 - Prediksi 3 Bulan Rolling
# ==================================================

@router.get("/next-three-months", response_model=ThreeMonthResponse)
def predict_next_three_months(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Prediksi pengeluaran 3 bulan ke depan dengan rolling prediction.
    Setiap prediksi jadi input untuk bulan berikutnya.
    """
    user_id = current_user.id

    # Ambil data bulanan (12 bulan terakhir)
    monthly_df = get_monthly_aggregates(user_id, db, months=12)
    months_available = len(monthly_df)

    # Cek data cukup
    if not has_enough_data(monthly_df):
        return ThreeMonthResponse(
            has_prediction=False,
            months_available=months_available,
            predictions=[],
            message=f"Butuh minimal {LOOKBACK} bulan data untuk prediksi."
        )

    try:
        model = get_model()
        scaler = get_scaler()
        scaler_target = get_scaler_target()
    except Exception as e:
        # ML model not available - return graceful response
        return ThreeMonthResponse(
            has_prediction=False,
            months_available=months_available,
            predictions=[],
            message="Fitur prediksi sedang tidak tersedia. Silakan coba lagi nanti."
        )

    try:
        # Month labels for Indonesian
        month_names = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                       "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

        predictions = []
        current_data = monthly_df.tail(LOOKBACK).copy()

        today = date.today()
        next_month = today.replace(day=1) + relativedelta(months=1)

        for i in range(3):
            target_month = next_month + relativedelta(months=i)
            month_str = target_month.strftime("%Y-%m")
            month_label = f"{month_names[target_month.month]} {target_month.year}"

            # Prepare input
            X_scaled = scaler.transform(current_data[INPUT_COLS])
            X_input = X_scaled.reshape(1, LOOKBACK, len(INPUT_COLS))

            # Predict
            pred_scaled = model.predict(X_input, verbose=0)
            pred_rp = float(scaler_target.inverse_transform(
                pred_scaled.reshape(-1, 1)
            )[0][0])

            # Confidence decreases for further predictions
            confidence = max(50, 87 - (i * 12))

            predictions.append(MonthPrediction(
                month=month_str,
                month_label=month_label,
                predicted_expense=round(pred_rp),
                confidence_percentage=confidence
            ))

            # Update current_data for rolling prediction
            # Use the prediction as the new row
            new_row = current_data.iloc[-1].copy()
            new_row['total_expense'] = pred_rp
            new_row['year'] = target_month.year
            new_row['month'] = target_month.month

            # Shift window: drop first, add new
            current_data = pd.concat([
                current_data.iloc[1:],
                pd.DataFrame([new_row])
            ]).reset_index(drop=True)

        # Calculate totals and trend
        total_predicted = sum(p.predicted_expense for p in predictions)
        average_predicted = total_predicted // 3

        # Determine trend
        if predictions[2].predicted_expense > predictions[0].predicted_expense * 1.05:
            trend = "increasing"
        elif predictions[2].predicted_expense < predictions[0].predicted_expense * 0.95:
            trend = "decreasing"
        else:
            trend = "stable"

        return ThreeMonthResponse(
            has_prediction=True,
            months_available=months_available,
            predictions=predictions,
            total_predicted=total_predicted,
            average_predicted=average_predicted,
            trend=trend,
            message=f"Prediksi 3 bulan berdasarkan {months_available} bulan data"
        )

    except Exception as e:
        # Prediction failed - return graceful response with error details
        import traceback
        print(f"Three-month prediction error: {e}")
        print(traceback.format_exc())
        return ThreeMonthResponse(
            has_prediction=False,
            months_available=months_available,
            predictions=[],
            message=f"Prediksi error: {str(e)}"
        )


# ==================================================
# ENDPOINT 7 - What-If Simulator
# ==================================================

@router.post("/what-if", response_model=WhatIfResponse)
def simulate_what_if(
    request: WhatIfRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Simulasi what-if: bagaimana jika income/expense berubah?
    Membandingkan baseline vs simulated prediction.
    """
    user_id = current_user.id

    # Ambil data bulanan (12 bulan terakhir)
    monthly_df = get_monthly_aggregates(user_id, db, months=12)
    months_available = len(monthly_df)

    # Cek data cukup
    if not has_enough_data(monthly_df):
        return WhatIfResponse(
            has_prediction=False,
            message=f"Butuh minimal {LOOKBACK} bulan data untuk simulasi."
        )

    try:
        model = get_model()
        scaler = get_scaler()
        scaler_target = get_scaler_target()
    except Exception as e:
        # ML model not available - return graceful response
        return WhatIfResponse(
            has_prediction=False,
            message="Fitur simulasi sedang tidak tersedia. Silakan coba lagi nanti."
        )

    try:
        # 1. Calculate BASELINE prediction
        last_n = monthly_df.tail(LOOKBACK).copy()
        X_scaled = scaler.transform(last_n[INPUT_COLS])
        X_input = X_scaled.reshape(1, LOOKBACK, len(INPUT_COLS))
        pred_scaled = model.predict(X_input, verbose=0)
        baseline_expense = float(scaler_target.inverse_transform(
            pred_scaled.reshape(-1, 1)
        )[0][0])

        # 2. Calculate SIMULATED prediction
        simulated_data = last_n.copy()

        # Apply income change
        if request.income_change != 0:
            multiplier = 1 + (request.income_change / 100)
            simulated_data['total_income'] = simulated_data['total_income'] * multiplier
            simulated_data['net'] = simulated_data['total_income'] - simulated_data['total_expense']

        # Apply category changes to expense
        total_category_impact = 0
        for category, change_pct in request.expense_category_changes.items():
            # Get category proportion from recent transactions
            two_months_ago = date.today().replace(day=1) - relativedelta(months=2)
            cat_total = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
                Transaction.user_id == user_id,
                Transaction.type == 'expense',
                Transaction.category == category,
                Transaction.date >= two_months_ago
            ).scalar()

            if cat_total > 0:
                # Calculate impact as percentage of total expense
                avg_month_expense = simulated_data['total_expense'].mean()
                cat_impact = (cat_total / 2) * (change_pct / 100)  # divide by 2 for monthly avg
                total_category_impact += cat_impact

        # Apply category impact to expense
        simulated_data['total_expense'] = simulated_data['total_expense'] + total_category_impact

        # Add flat monthly expense
        if request.add_monthly_expense != 0:
            simulated_data['total_expense'] = simulated_data['total_expense'] + request.add_monthly_expense

        # Recalculate derived fields
        simulated_data['net'] = simulated_data['total_income'] - simulated_data['total_expense']
        simulated_data['avg_expense'] = simulated_data['total_expense'] / simulated_data['frekuensi_exp'].clip(lower=1)

        # Predict with simulated data
        X_sim_scaled = scaler.transform(simulated_data[INPUT_COLS])
        X_sim_input = X_sim_scaled.reshape(1, LOOKBACK, len(INPUT_COLS))
        pred_sim_scaled = model.predict(X_sim_input, verbose=0)
        simulated_expense = float(scaler_target.inverse_transform(
            pred_sim_scaled.reshape(-1, 1)
        )[0][0])

        # 3. Calculate broke days comparison
        thirty_days_ago = date.today() - relativedelta(days=30)
        all_transactions = db.query(Transaction).filter(
            Transaction.user_id == user_id
        ).all()

        total_income = sum(t.amount for t in all_transactions if t.type == 'income')
        total_exp = sum(t.amount for t in all_transactions if t.type == 'expense')
        current_balance = total_income - total_exp

        recent_expenses = [t for t in all_transactions if t.type == 'expense' and t.date >= thirty_days_ago]
        avg_daily_baseline = sum(t.amount for t in recent_expenses) / 30 if recent_expenses else 0

        baseline_broke_days = int(current_balance / avg_daily_baseline) if avg_daily_baseline > 0 else 999

        # Simulated daily expense based on predicted change
        expense_change_ratio = simulated_expense / baseline_expense if baseline_expense > 0 else 1
        avg_daily_simulated = avg_daily_baseline * expense_change_ratio
        simulated_broke_days = int(current_balance / avg_daily_simulated) if avg_daily_simulated > 0 else 999

        # 4. Generate insights
        insights = []
        difference = round(simulated_expense - baseline_expense)
        difference_pct = ((simulated_expense - baseline_expense) / baseline_expense * 100) if baseline_expense > 0 else 0

        if difference < 0:
            insights.append(f"Kamu bisa hemat sekitar Rp {abs(difference):,}/bulan!")
        elif difference > 0:
            insights.append(f"Pengeluaran diprediksi naik Rp {difference:,}/bulan")

        broke_diff = simulated_broke_days - baseline_broke_days
        if broke_diff > 7:
            insights.append(f"Uangmu bisa bertahan {broke_diff} hari lebih lama 🎉")
        elif broke_diff < -7:
            insights.append(f"Hati-hati, uangmu bisa habis {abs(broke_diff)} hari lebih cepat!")

        if request.income_change < 0:
            insights.append("Pertimbangkan side hustle atau freelance untuk tambahan income")

        return WhatIfResponse(
            has_prediction=True,
            baseline_expense=round(baseline_expense),
            simulated_expense=round(simulated_expense),
            difference=difference,
            difference_percentage=round(difference_pct, 1),
            baseline_broke_days=baseline_broke_days,
            simulated_broke_days=simulated_broke_days,
            broke_days_difference=broke_diff,
            insights=insights,
            message="Hasil simulasi berhasil dihitung"
        )

    except Exception as e:
        # Simulation failed - return graceful response with error details
        import traceback
        print(f"What-if simulation error: {e}")
        print(traceback.format_exc())
        return WhatIfResponse(
            has_prediction=False,
            message=f"Simulasi error: {str(e)}"
        )


# ==================================================
# ENDPOINT 5 - Health Score (existing, kept for compatibility)
# ==================================================

@router.get("/health-score", response_model=HealthScore)
def get_health_score(
    month: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Calculate financial health score based on spending patterns."""
    this_month_start, this_month_end = parse_month(month)

    # Get income and expense for this month
    income = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= this_month_start,
        Transaction.date <= this_month_end,
        Transaction.type == "income"
    ).scalar()

    expense = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= this_month_start,
        Transaction.date <= this_month_end,
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

    # Check 2: Essential spending ratio
    essential_categories = ["makan", "transport", "kos/kontrakan", "tagihan"]
    essential_spending = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= this_month_start,
        Transaction.date <= this_month_end,
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
        Transaction.date >= this_month_start,
        Transaction.date <= this_month_end
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
