"""Release readiness: promo redemption, private file expiry and bucket reservations."""

from alembic import op
import sqlalchemy as sa


revision = "20260826_0006"
down_revision = "20260825_0005"
branch_labels = None
depends_on = None


def _tables(bind):
    return set(sa.inspect(bind).get_table_names())


def _columns(bind, table):
    return {item["name"] for item in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    tables = _tables(bind)
    if "promo_redemptions" not in tables:
        op.create_table(
            "promo_redemptions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("promo_id", sa.Integer(), sa.ForeignKey("promo_codes.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("credits", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("promo_id", "user_id", name="uq_promo_redemptions_promo_user"),
        )
        op.create_index("ix_promo_redemptions_promo_id", "promo_redemptions", ["promo_id"])
        op.create_index("ix_promo_redemptions_user_id", "promo_redemptions", ["user_id"])
    if "reserved_buckets" not in _columns(bind, "generation_jobs"):
        op.add_column("generation_jobs", sa.Column("reserved_buckets", sa.Text(), nullable=False, server_default="{}"))
    if "expires_at" not in _columns(bind, "file_records"):
        op.add_column("file_records", sa.Column("expires_at", sa.DateTime(timezone=True)))
        op.create_index("ix_file_records_expires_at", "file_records", ["expires_at"])


def downgrade() -> None:
    bind = op.get_bind()
    tables = _tables(bind)
    if "file_records" in tables and "expires_at" in _columns(bind, "file_records"):
        op.drop_index("ix_file_records_expires_at", table_name="file_records")
        op.drop_column("file_records", "expires_at")
    if "generation_jobs" in tables and "reserved_buckets" in _columns(bind, "generation_jobs"):
        op.drop_column("generation_jobs", "reserved_buckets")
    if "promo_redemptions" in tables:
        op.drop_table("promo_redemptions")
