"""Admin schemas — roles, models, plans, logs, etc."""

from datetime import datetime
from pydantic import BaseModel


class RoleInfo(BaseModel):
    id: int
    name: str
    description: str
    permissions: dict
    is_system: bool
    created_at: str | None = None

    class Config:
        from_attributes = True


class RoleCreate(BaseModel):
    name: str
    description: str = ""
    permissions: dict = {}


class AiModelInfo(BaseModel):
    id: int
    name: str
    description: str
    provider: str
    category: str
    or_model_id: str
    price_input: float
    price_output: float
    price_unit: float
    margin: float
    is_active: bool
    is_visible: bool
    is_free_available: bool
    request_count: int
    vision: bool

    class Config:
        from_attributes = True


class CreditPlanInfo(BaseModel):
    id: int
    name: str
    description: str
    price_rub: int
    credits: int
    bonus_credits: int
    old_price_rub: int | None
    badge: str | None
    is_active: bool
    sort_order: int
    purchase_count: int
    credit_price: float

    class Config:
        from_attributes = True


class CreditOperationInfo(BaseModel):
    id: int
    user_id: int
    op_type: str
    credit_type: str
    amount: int
    balance_before: int
    balance_after: int
    source: str
    related_id: str | None
    admin_id: int | None
    comment: str
    created_at: str | None = None

    class Config:
        from_attributes = True


class AdminLogInfo(BaseModel):
    id: int
    admin_id: int
    action: str
    target_type: str
    target_id: str | None
    old_value: str
    new_value: str
    ip: str | None
    result: str
    detail: str
    created_at: str | None = None

    class Config:
        from_attributes = True


class SystemErrorInfo(BaseModel):
    id: int
    error_code: str
    error_text: str
    service: str
    model_id: str | None
    user_id: int | None
    repeat_count: int
    status: str
    created_at: str | None = None

    class Config:
        from_attributes = True
