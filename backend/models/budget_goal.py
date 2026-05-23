import uuid
from datetime import datetime
from sqlalchemy import Column, String, BigInteger, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship

from database import Base
from models.base import GUID


class BudgetGoal(Base):
    __tablename__ = "budget_goals"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category = Column(String(100), nullable=False)
    budget_limit = Column(BigInteger, nullable=False)  # dalam Rupiah
    month = Column(String(7), nullable=False)  # format YYYY-MM
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="budget_goals")

    __table_args__ = (
        Index("idx_budget_goals_user_id", "user_id"),
        Index("idx_budget_goals_user_month", "user_id", "month"),
    )
