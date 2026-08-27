"""Create a safe baseline without deleting existing data."""

from alembic import op
import sqlalchemy as sa
import secrets

from app.models import Base
from app.core.security import hash_password, verify_password

revision = "20260821_0001"
down_revision = None
branch_labels = None
depends_on = None


USER_COLUMNS = {
    "last_daily_reset": sa.Column("last_daily_reset", sa.Date(), nullable=True),
    "credits_paid": sa.Column("credits_paid", sa.Integer(), server_default="0", nullable=False),
    "credits_free": sa.Column("credits_free", sa.Integer(), server_default="0", nullable=False),
    "credits_bonus": sa.Column("credits_bonus", sa.Integer(), server_default="0", nullable=False),
    "credits_promo": sa.Column("credits_promo", sa.Integer(), server_default="0", nullable=False),
    "free_program_start": sa.Column("free_program_start", sa.Date(), nullable=True),
    "free_program_days": sa.Column("free_program_days", sa.Integer(), server_default="60", nullable=False),
    "role_id": sa.Column("role_id", sa.Integer(), nullable=True),
    "total_spent_credits": sa.Column("total_spent_credits", sa.Integer(), server_default="0", nullable=False),
    "total_paid_rub": sa.Column("total_paid_rub", sa.Integer(), server_default="0", nullable=False),
    "request_count": sa.Column("request_count", sa.Integer(), server_default="0", nullable=False),
    "chat_count": sa.Column("chat_count", sa.Integer(), server_default="0", nullable=False),
    "registered_by": sa.Column("registered_by", sa.String(50), server_default="email", nullable=False),
    "reg_ip": sa.Column("reg_ip", sa.String(50), nullable=True),
    "reg_ua": sa.Column("reg_ua", sa.String(500), nullable=True),
    "reg_source": sa.Column("reg_source", sa.String(255), nullable=True),
    "reg_utm": sa.Column("reg_utm", sa.String(500), nullable=True),
    "referrer_id": sa.Column("referrer_id", sa.Integer(), nullable=True),
    "referral_code": sa.Column("referral_code", sa.String(50), nullable=True),
}


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    inspector = sa.inspect(bind)
    if "users" in inspector.get_table_names():
        existing = {column["name"] for column in inspector.get_columns("users")}
        with op.batch_alter_table("users") as batch:
            for name, column in USER_COLUMNS.items():
                if name not in existing:
                    batch.add_column(column)
        existing = {column["name"] for column in sa.inspect(bind).get_columns("users")}
        if {"total_paid_rub", "total_spent_rub"} <= existing:
            op.execute("UPDATE users SET total_paid_rub = MAX(COALESCE(total_paid_rub, 0), COALESCE(total_spent_rub, 0))")
        # Older OAuth accounts used a password derived from the public provider ID.
        # Rotate only hashes that actually match that legacy value; linked password
        # accounts are left untouched.
        if {"id", "hashed_password", "yandex_id", "vk_id"} <= existing:
            rows = bind.execute(sa.text("SELECT id, hashed_password, yandex_id, vk_id FROM users")).mappings()
            for row in rows:
                candidates = []
                if row["yandex_id"]:
                    candidates.append(f"oauth_yandex_{row['yandex_id']}")
                if row["vk_id"]:
                    candidates.append(f"oauth_vk_{row['vk_id']}")
                if any(verify_password(candidate, row["hashed_password"]) for candidate in candidates):
                    bind.execute(
                        sa.text("UPDATE users SET hashed_password = :password WHERE id = :user_id"),
                        {"password": hash_password(secrets.token_urlsafe(48)), "user_id": row["id"]},
                    )


def downgrade() -> None:
    # The baseline is intentionally non-destructive. Roll back application code,
    # not customer data.
    pass
