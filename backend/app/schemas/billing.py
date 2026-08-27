"""Billing schemas."""

from pydantic import BaseModel


class PlanInfo(BaseModel):
    id: str
    name: str
    price: int       # копейки
    credits: int
    bonus: int
    popular: bool = False


class TopUpRequest(BaseModel):
    plan_id: str


class TopUpResponse(BaseModel):
    payment_id: str
    payment_url: str


class BalanceResponse(BaseModel):
    credits: int


class TransactionInfo(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    amount: int
    rub_amount: int
    type: str
    description: str
    created_at: str
