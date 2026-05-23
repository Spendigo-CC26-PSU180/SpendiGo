from typing import List, Optional
from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from core.deps import get_db, get_current_user
from models.user import User
from models.budget_goal import BudgetGoal
from models.transaction import Transaction

router = APIRouter(prefix="/budget", tags=["budget"])


class BudgetGoalCreate(BaseModel):
    category: str
    budget_limit: int
    month: Optional[str] = None  # Defaults to current month


class BudgetGoalUpdate(BaseModel):
    budget_limit: int


class BudgetGoalResponse(BaseModel):
    id: UUID
    category: str
    budget_limit: int
    spent: int
    percentage: float
    month: str

    class Config:
        from_attributes = True


class BudgetGoalListResponse(BaseModel):
    goals: List[BudgetGoalResponse]
    total_budget: int
    total_spent: int


def get_current_month() -> str:
    today = date.today()
    return f"{today.year}-{str(today.month).zfill(2)}"


@router.get("", response_model=BudgetGoalListResponse)
def get_budget_goals(
    month: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all budget goals for a month with spending progress."""
    target_month = month or get_current_month()

    # Get month date range
    year, mon = map(int, target_month.split("-"))
    start_date = date(year, mon, 1)
    if mon == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, mon + 1, 1)

    # Get budget goals
    goals = db.query(BudgetGoal).filter(
        BudgetGoal.user_id == current_user.id,
        BudgetGoal.month == target_month
    ).all()

    # Get spending by category for this month
    spending = db.query(
        Transaction.category,
        func.coalesce(func.sum(Transaction.amount), 0).label("total")
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start_date,
        Transaction.date < end_date,
        Transaction.type == "expense"
    ).group_by(Transaction.category).all()

    spending_map = {s.category: s.total for s in spending}

    # Build response
    goal_responses = []
    total_budget = 0
    total_spent = 0

    for goal in goals:
        spent = spending_map.get(goal.category, 0)
        percentage = (spent / goal.budget_limit * 100) if goal.budget_limit > 0 else 0

        goal_responses.append(BudgetGoalResponse(
            id=goal.id,
            category=goal.category,
            budget_limit=goal.budget_limit,
            spent=spent,
            percentage=min(percentage, 100),  # Cap at 100%
            month=goal.month
        ))

        total_budget += goal.budget_limit
        total_spent += spent

    # Sort by percentage (highest first)
    goal_responses.sort(key=lambda x: x.percentage, reverse=True)

    return BudgetGoalListResponse(
        goals=goal_responses,
        total_budget=total_budget,
        total_spent=total_spent
    )


@router.post("", response_model=BudgetGoalResponse)
def create_budget_goal(
    goal_data: BudgetGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new budget goal."""
    target_month = goal_data.month or get_current_month()

    # Check if goal already exists for this category and month
    existing = db.query(BudgetGoal).filter(
        BudgetGoal.user_id == current_user.id,
        BudgetGoal.category == goal_data.category,
        BudgetGoal.month == target_month
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Budget goal for {goal_data.category} already exists this month"
        )

    # Create goal
    goal = BudgetGoal(
        user_id=current_user.id,
        category=goal_data.category,
        budget_limit=goal_data.budget_limit,
        month=target_month
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)

    # Get current spending
    year, mon = map(int, target_month.split("-"))
    start_date = date(year, mon, 1)
    if mon == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, mon + 1, 1)

    spent = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == current_user.id,
        Transaction.category == goal_data.category,
        Transaction.date >= start_date,
        Transaction.date < end_date,
        Transaction.type == "expense"
    ).scalar()

    percentage = (spent / goal.budget_limit * 100) if goal.budget_limit > 0 else 0

    return BudgetGoalResponse(
        id=goal.id,
        category=goal.category,
        budget_limit=goal.budget_limit,
        spent=spent,
        percentage=min(percentage, 100),
        month=goal.month
    )


@router.put("/{goal_id}", response_model=BudgetGoalResponse)
def update_budget_goal(
    goal_id: UUID,
    goal_data: BudgetGoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a budget goal."""
    goal = db.query(BudgetGoal).filter(
        BudgetGoal.id == goal_id,
        BudgetGoal.user_id == current_user.id
    ).first()

    if not goal:
        raise HTTPException(status_code=404, detail="Budget goal not found")

    goal.budget_limit = goal_data.budget_limit
    db.commit()
    db.refresh(goal)

    # Get current spending
    year, mon = map(int, goal.month.split("-"))
    start_date = date(year, mon, 1)
    if mon == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, mon + 1, 1)

    spent = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == current_user.id,
        Transaction.category == goal.category,
        Transaction.date >= start_date,
        Transaction.date < end_date,
        Transaction.type == "expense"
    ).scalar()

    percentage = (spent / goal.budget_limit * 100) if goal.budget_limit > 0 else 0

    return BudgetGoalResponse(
        id=goal.id,
        category=goal.category,
        budget_limit=goal.budget_limit,
        spent=spent,
        percentage=min(percentage, 100),
        month=goal.month
    )


@router.delete("/{goal_id}")
def delete_budget_goal(
    goal_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a budget goal."""
    goal = db.query(BudgetGoal).filter(
        BudgetGoal.id == goal_id,
        BudgetGoal.user_id == current_user.id
    ).first()

    if not goal:
        raise HTTPException(status_code=404, detail="Budget goal not found")

    db.delete(goal)
    db.commit()

    return {"message": "Budget goal deleted"}
