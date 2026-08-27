"""Add model capabilities and persistent media generation jobs."""

from alembic import op
import sqlalchemy as sa


revision = "20260821_0002"
down_revision = "20260821_0001"
branch_labels = None
depends_on = None


MODEL_COLUMNS = {
    "input_modalities": sa.Column("input_modalities", sa.Text(), nullable=False, server_default='["text"]'),
    "output_modalities": sa.Column("output_modalities", sa.Text(), nullable=False, server_default='["text"]'),
    "supported_parameters": sa.Column("supported_parameters", sa.Text(), nullable=False, server_default="{}"),
    "openrouter_pricing": sa.Column("openrouter_pricing", sa.Text(), nullable=False, server_default="{}"),
    "auto_route_enabled": sa.Column("auto_route_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    "or_last_synced_at": sa.Column("or_last_synced_at", sa.DateTime(timezone=True), nullable=True),
}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "ai_models" in inspector.get_table_names():
        existing = {column["name"] for column in inspector.get_columns("ai_models")}
        with op.batch_alter_table("ai_models") as batch:
            for name, column in MODEL_COLUMNS.items():
                if name not in existing:
                    batch.add_column(column)
        op.execute("UPDATE ai_models SET input_modalities = '[\"text\",\"image\"]' WHERE vision = 1")
        op.execute(
            "UPDATE ai_models SET output_modalities = '[\"image\"]', input_modalities = '[\"text\"]', "
            "auto_route_enabled = 1 WHERE or_model_id = 'google/gemini-3.1-flash-lite-image'"
        )

    if "generation_jobs" not in sa.inspect(bind).get_table_names():
        op.create_table(
            "generation_jobs",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("session_id", sa.String(36), nullable=True),
            sa.Column("kind", sa.String(16), nullable=False),
            sa.Column("requested_model", sa.String(200), nullable=False),
            sa.Column("effective_model", sa.String(200), nullable=False),
            sa.Column("prompt", sa.Text(), nullable=False),
            sa.Column("parameters", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("provider_job_id", sa.String(200), nullable=True, unique=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("reserved_credits", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("charged_credits", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("provider_cost_usd", sa.String(40), nullable=True),
            sa.Column("assets", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("error", sa.Text(), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_generation_jobs_user_id", "generation_jobs", ["user_id"])
        op.create_index("ix_generation_jobs_session_id", "generation_jobs", ["session_id"])
        op.create_index("ix_generation_jobs_kind", "generation_jobs", ["kind"])
        op.create_index("ix_generation_jobs_status", "generation_jobs", ["status"])


def downgrade() -> None:
    # Data-preserving migration: application rollback should not remove media
    # history or capability snapshots.
    pass
