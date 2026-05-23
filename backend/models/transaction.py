import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, BigInteger, Date, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship

from database import Base
from models.base import GUID


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    amount = Column(BigInteger, nullable=False)  # dalam Rupiah
    type = Column(String(10), nullable=False)  # 'income' | 'expense'
    category = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="transactions")

    __table_args__ = (
        Index("idx_transactions_user_id", "user_id"),
        Index("idx_transactions_date", "date"),
        Index("idx_transactions_user_date", "user_id", "date"),
    )
