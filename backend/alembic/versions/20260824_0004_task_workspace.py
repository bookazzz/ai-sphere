"""Add task-first templates, funnel events, projects and library metadata."""

from alembic import op
import sqlalchemy as sa


revision = "20260824_0004"
down_revision = "20260823_0003"
branch_labels = None
depends_on = None


def _columns(bind, table: str) -> set[str]:
    return {item["name"] for item in sa.inspect(bind).get_columns(table)}


def _indexes(bind, table: str) -> set[str]:
    return {item["name"] for item in sa.inspect(bind).get_indexes(table)}


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())

    if "task_templates" not in tables:
        op.create_table(
            "task_templates",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("slug", sa.String(100), nullable=False, unique=True),
            sa.Column("title", sa.String(160), nullable=False),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("category", sa.String(32), nullable=False),
            sa.Column("task_type", sa.String(50), nullable=False),
            sa.Column("prompt_template", sa.Text(), nullable=False),
            sa.Column("example_input", sa.Text(), nullable=False, server_default=""),
            sa.Column("example_output", sa.Text(), nullable=False, server_default=""),
            sa.Column("required_input", sa.String(255), nullable=False, server_default="Текст запроса"),
            sa.Column("preview_url", sa.String(500), nullable=False, server_default=""),
            sa.Column("default_parameters", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("preferred_model", sa.String(200), nullable=False, server_default=""),
            sa.Column("fallback_models", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("estimated_credits_label", sa.String(100), nullable=False, server_default=""),
            sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="100"),
            sa.Column("usage_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_task_templates_slug", "task_templates", ["slug"], unique=True)
        op.create_index("ix_task_templates_category", "task_templates", ["category"])
        op.create_index("ix_task_templates_task_type", "task_templates", ["task_type"])
        op.create_index("ix_task_templates_is_featured", "task_templates", ["is_featured"])
        op.create_index("ix_task_templates_is_active", "task_templates", ["is_active"])

    if "product_events" not in tables:
        op.create_table(
            "product_events",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
            sa.Column("anonymous_id", sa.String(80), nullable=False, server_default=""),
            sa.Column("event_name", sa.String(50), nullable=False),
            sa.Column("template_id", sa.Integer(), sa.ForeignKey("task_templates.id", ondelete="SET NULL")),
            sa.Column("task_type", sa.String(50), nullable=False, server_default=""),
            sa.Column("model", sa.String(200), nullable=False, server_default=""),
            sa.Column("metadata_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        for column in ("user_id", "anonymous_id", "event_name", "template_id", "task_type"):
            op.create_index(f"ix_product_events_{column}", "product_events", [column])

    if "projects" not in tables:
        op.create_table(
            "projects",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("recipe_slug", sa.String(100), nullable=False, server_default=""),
            sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
            sa.Column("current_step", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("data_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("allow_prompt", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("share_slug", sa.String(64), unique=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        for column in ("user_id", "recipe_slug", "status", "is_public", "share_slug"):
            op.create_index(f"ix_projects_{column}", "projects", [column])

    ai_columns = _columns(bind, "ai_models")
    for name, column in (
        ("catalog_miss_count", sa.Column("catalog_miss_count", sa.Integer(), nullable=False, server_default="0")),
        ("availability_status", sa.Column("availability_status", sa.String(20), nullable=False, server_default="unknown")),
        ("recommended_priority", sa.Column("recommended_priority", sa.Integer(), nullable=False, server_default="100")),
        ("last_provider_error", sa.Column("last_provider_error", sa.Text(), nullable=False, server_default="")),
    ):
        if name not in ai_columns:
            op.add_column("ai_models", column)

    generation_columns = _columns(bind, "generation_jobs")
    for name, column in (
        # SQLite cannot add a foreign-key constraint with ALTER TABLE. Fresh
        # databases still receive the FK from SQLAlchemy metadata; upgraded
        # databases keep the same application-level relationship without it.
        ("template_id", sa.Column("template_id", sa.Integer())),
        ("task_type", sa.Column("task_type", sa.String(50), nullable=False, server_default="")),
        ("is_favorite", sa.Column("is_favorite", sa.Boolean(), nullable=False, server_default=sa.false())),
        ("is_public", sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.false())),
        ("allow_prompt", sa.Column("allow_prompt", sa.Boolean(), nullable=False, server_default=sa.false())),
        ("share_slug", sa.Column("share_slug", sa.String(64))),
    ):
        if name not in generation_columns:
            op.add_column("generation_jobs", column)
    generation_indexes = _indexes(bind, "generation_jobs")
    for name, columns, unique in (
        ("ix_generation_jobs_template_id", ["template_id"], False),
        ("ix_generation_jobs_is_public", ["is_public"], False),
        ("ix_generation_jobs_share_slug", ["share_slug"], True),
    ):
        if name not in generation_indexes:
            op.create_index(name, "generation_jobs", columns, unique=unique)


def downgrade() -> None:
    # User work and analytics are intentionally retained on code rollback.
    pass
