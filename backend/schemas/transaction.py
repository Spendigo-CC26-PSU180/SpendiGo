from pydantic import BaseModel, field_validator
from typing import Optional, List, Literal
from uuid import UUID
from datetime import date, datetime


EXPENSE_CATEGORIES = [
    "makan", "transport", "belanja online", "fashion", "kopi",
    "hiburan", "nongkrong", "top up game", "kuota", "skincare",
    "kesehatan", "edukasi", "kos/kontrakan", "tagihan", "investasi", "lainnya"
]

INCOME_CATEGORIES = [
    "uang saku", "gaji", "freelance", "part time",
    "beasiswa", "transfer masuk", "lainnya"
]


class TransactionCreate(BaseModel):
    date: date
    amount: int
    type: Literal["income", "expense"]
    category: str
    description: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Amount harus lebih dari 0")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str, info) -> str:
        # Category validation will be done in the endpoint based on type
        return v.lower()


class TransactionUpdate(BaseModel):
    date: Optional[date] = None
    amount: Optional[int] = None
    type: Optional[Literal["income", "expense"]] = None
    category: Optional[str] = None
    description: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError("Amount harus lebih dari 0")
        return v


class TransactionResponse(BaseModel):
    id: UUID
    user_id: UUID
    date: date
    amount: int
    type: str
    category: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TransactionListResponse(BaseModel):
    data: List[TransactionResponse]
    total: int
    page: int
    limit: int
    total_pages: int
