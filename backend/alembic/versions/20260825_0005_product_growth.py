"""Add product analytics, campaigns, experiments and gamification."""

from alembic import op
import sqlalchemy as sa


revision = "20260825_0005"
down_revision = "20260824_0004"
branch_labels = None
depends_on = None


def _tables(bind):
    return set(sa.inspect(bind).get_table_names())


def _columns(bind, table):
    return {item["name"] for item in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    tables = _tables(bind)

    event_columns = _columns(bind, "product_events")
    additions = (
        ("event_id", sa.Column("event_id", sa.String(36))),
        ("visit_session_id", sa.Column("visit_session_id", sa.String(80), nullable=False, server_default="")),
        ("page", sa.Column("page", sa.String(500), nullable=False, server_default="")),
        ("source", sa.Column("source", sa.String(255), nullable=False, server_default="")),
        ("device_type", sa.Column("device_type", sa.String(20), nullable=False, server_default="")),
        ("experiment_variants", sa.Column("experiment_variants", sa.Text(), nullable=False, server_default="{}")),
        ("duration_ms", sa.Column("duration_ms", sa.Integer(), nullable=False, server_default="0")),
    )
    for name, column in additions:
        if name not in event_columns:
            op.add_column("product_events", column)
    op.execute("UPDATE product_events SET event_id = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-a' || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))) WHERE event_id IS NULL OR event_id = ''")
    indexes = {item["name"] for item in sa.inspect(bind).get_indexes("product_events")}
    for name, columns, unique in (
        ("ix_product_events_event_id", ["event_id"], True),
        ("ix_product_events_visit_session_id", ["visit_session_id"], False),
        ("ix_product_events_source", ["source"], False),
        ("ix_product_events_device_type", ["device_type"], False),
        ("ix_product_events_created_name", ["created_at", "event_name"], False),
    ):
        if name not in indexes:
            op.create_index(name, "product_events", columns, unique=unique)

    if "saved_segments" not in tables:
        op.create_table("saved_segments",
            sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(160), nullable=False),
            sa.Column("description", sa.Text(), nullable=False, server_default=""), sa.Column("filters_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False), sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
        op.create_index("ix_saved_segments_is_active", "saved_segments", ["is_active"])

    if "campaigns" not in tables:
        op.create_table("campaigns",
            sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(160), nullable=False),
            sa.Column("placement", sa.String(30), nullable=False, server_default="notification"), sa.Column("title", sa.String(255), nullable=False),
            sa.Column("body", sa.Text(), nullable=False), sa.Column("button_text", sa.String(100), nullable=False, server_default=""),
            sa.Column("button_url", sa.String(500), nullable=False, server_default=""), sa.Column("segment_id", sa.Integer(), sa.ForeignKey("saved_segments.id", ondelete="SET NULL")),
            sa.Column("audience_json", sa.Text(), nullable=False, server_default="{}"), sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
            sa.Column("starts_at", sa.DateTime(timezone=True)), sa.Column("ends_at", sa.DateTime(timezone=True)),
            sa.Column("frequency_cap", sa.Integer(), nullable=False, server_default="1"), sa.Column("holdout_pct", sa.Integer(), nullable=False, server_default="10"),
            sa.Column("goal_event", sa.String(50), nullable=False, server_default="payment_succeeded"), sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(timezone=True)))
        op.create_index("ix_campaigns_status", "campaigns", ["status"])
        op.create_index("ix_campaigns_segment_id", "campaigns", ["segment_id"])

    if "campaign_deliveries" not in tables:
        op.create_table("campaign_deliveries",
            sa.Column("id", sa.Integer(), primary_key=True), sa.Column("delivery_key", sa.String(180), nullable=False, unique=True),
            sa.Column("campaign_id", sa.Integer(), sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE")), sa.Column("anonymous_id", sa.String(80), nullable=False, server_default=""),
            sa.Column("is_holdout", sa.Boolean(), nullable=False, server_default=sa.false()), sa.Column("impression_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("first_shown_at", sa.DateTime(timezone=True)), sa.Column("last_shown_at", sa.DateTime(timezone=True)),
            sa.Column("opened_at", sa.DateTime(timezone=True)), sa.Column("clicked_at", sa.DateTime(timezone=True)),
            sa.Column("dismissed_at", sa.DateTime(timezone=True)), sa.Column("converted_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
        for column in ("delivery_key", "campaign_id", "user_id", "anonymous_id"):
            op.create_index(f"ix_campaign_deliveries_{column}", "campaign_deliveries", [column], unique=column == "delivery_key")

    if "surveys" not in tables:
        op.create_table("surveys", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("code", sa.String(80), nullable=False, unique=True),
            sa.Column("title", sa.String(255), nullable=False), sa.Column("trigger_event", sa.String(50), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="active"), sa.Column("is_critical", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("frequency_days", sa.Integer(), nullable=False, server_default="14"), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
        op.create_index("ix_surveys_code", "surveys", ["code"], unique=True); op.create_index("ix_surveys_trigger_event", "surveys", ["trigger_event"]); op.create_index("ix_surveys_status", "surveys", ["status"])
    if "survey_questions" not in tables:
        op.create_table("survey_questions", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("survey_id", sa.Integer(), sa.ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False),
            sa.Column("prompt", sa.Text(), nullable=False), sa.Column("question_type", sa.String(20), nullable=False, server_default="single"),
            sa.Column("options_json", sa.Text(), nullable=False, server_default="[]"), sa.Column("sort_order", sa.Integer(), nullable=False, server_default="100"), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
        op.create_index("ix_survey_questions_survey_id", "survey_questions", ["survey_id"])
    if "survey_responses" not in tables:
        op.create_table("survey_responses", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("survey_id", sa.Integer(), sa.ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False),
            sa.Column("question_id", sa.Integer(), sa.ForeignKey("survey_questions.id", ondelete="CASCADE"), nullable=False), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
            sa.Column("anonymous_id", sa.String(80), nullable=False, server_default=""), sa.Column("visit_session_id", sa.String(80), nullable=False, server_default=""),
            sa.Column("answer", sa.Text(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
        for column in ("survey_id", "question_id", "user_id", "anonymous_id", "visit_session_id"):
            op.create_index(f"ix_survey_responses_{column}", "survey_responses", [column])

    if "missions" not in tables:
        op.create_table("missions", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("code", sa.String(80), nullable=False, unique=True),
            sa.Column("title", sa.String(160), nullable=False), sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("criteria_json", sa.Text(), nullable=False, server_default="{}"), sa.Column("reward_credits", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("reward_xp", sa.Integer(), nullable=False, server_default="0"), sa.Column("period", sa.String(20), nullable=False, server_default="lifetime"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()), sa.Column("sort_order", sa.Integer(), nullable=False, server_default="100"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
        op.create_index("ix_missions_code", "missions", ["code"], unique=True); op.create_index("ix_missions_is_active", "missions", ["is_active"])
    if "achievements" not in tables:
        op.create_table("achievements", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("code", sa.String(80), nullable=False, unique=True),
            sa.Column("title", sa.String(160), nullable=False), sa.Column("description", sa.Text(), nullable=False, server_default=""), sa.Column("icon", sa.String(40), nullable=False, server_default="✦"),
            sa.Column("criteria_json", sa.Text(), nullable=False, server_default="{}"), sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
        op.create_index("ix_achievements_code", "achievements", ["code"], unique=True)
    if "user_progress" not in tables:
        op.create_table("user_progress", sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("xp", sa.Integer(), nullable=False, server_default="0"), sa.Column("level", sa.String(30), nullable=False, server_default="Новичок"),
            sa.Column("streak_days", sa.Integer(), nullable=False, server_default="0"), sa.Column("last_active_date", sa.Date()),
            sa.Column("monthly_bonus_credits", sa.Integer(), nullable=False, server_default="0"), sa.Column("bonus_month", sa.String(7), nullable=False, server_default=""), sa.Column("updated_at", sa.DateTime(timezone=True)))
    if "user_mission_progress" not in tables:
        op.create_table("user_mission_progress", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("mission_id", sa.Integer(), sa.ForeignKey("missions.id", ondelete="CASCADE"), nullable=False), sa.Column("period_key", sa.String(20), nullable=False, server_default="lifetime"),
            sa.Column("current_value", sa.Integer(), nullable=False, server_default="0"), sa.Column("progress_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("completed_at", sa.DateTime(timezone=True)), sa.Column("rewarded_at", sa.DateTime(timezone=True)), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("user_id", "mission_id", "period_key", name="uq_user_mission_period"))
        op.create_index("ix_user_mission_progress_user_id", "user_mission_progress", ["user_id"]); op.create_index("ix_user_mission_progress_mission_id", "user_mission_progress", ["mission_id"])
    if "user_achievements" not in tables:
        op.create_table("user_achievements", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("achievement_id", sa.Integer(), sa.ForeignKey("achievements.id", ondelete="CASCADE"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"))
        op.create_index("ix_user_achievements_user_id", "user_achievements", ["user_id"]); op.create_index("ix_user_achievements_achievement_id", "user_achievements", ["achievement_id"])
    if "reward_ledger" not in tables:
        op.create_table("reward_ledger", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("reward_key", sa.String(180), nullable=False, unique=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("source_type", sa.String(30), nullable=False),
            sa.Column("source_id", sa.String(100), nullable=False, server_default=""), sa.Column("xp_amount", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("credit_amount", sa.Integer(), nullable=False, server_default="0"), sa.Column("detail_json", sa.Text(), nullable=False, server_default="{}"), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
        op.create_index("ix_reward_ledger_reward_key", "reward_ledger", ["reward_key"], unique=True); op.create_index("ix_reward_ledger_user_id", "reward_ledger", ["user_id"])

    if "experiments" not in tables:
        op.create_table("experiments", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(160), nullable=False), sa.Column("surface", sa.String(80), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="draft"), sa.Column("primary_metric", sa.String(50), nullable=False, server_default="activation"),
            sa.Column("guardrails_json", sa.Text(), nullable=False, server_default="[]"), sa.Column("winner_variant_id", sa.Integer()),
            sa.Column("started_at", sa.DateTime(timezone=True)), sa.Column("ended_at", sa.DateTime(timezone=True)), sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
        op.create_index("ix_experiments_surface", "experiments", ["surface"]); op.create_index("ix_experiments_status", "experiments", ["status"])
    if "experiment_variants" not in tables:
        op.create_table("experiment_variants", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("experiment_id", sa.Integer(), sa.ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False),
            sa.Column("key", sa.String(40), nullable=False), sa.Column("name", sa.String(100), nullable=False), sa.Column("payload_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("weight", sa.Float(), nullable=False, server_default="0.5"), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("experiment_id", "key", name="uq_experiment_variant_key"))
        op.create_index("ix_experiment_variants_experiment_id", "experiment_variants", ["experiment_id"])
    if "experiment_assignments" not in tables:
        op.create_table("experiment_assignments", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("assignment_key", sa.String(180), nullable=False, unique=True),
            sa.Column("experiment_id", sa.Integer(), sa.ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False), sa.Column("variant_id", sa.Integer(), sa.ForeignKey("experiment_variants.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")), sa.Column("anonymous_id", sa.String(80), nullable=False, server_default=""),
            sa.Column("exposed_at", sa.DateTime(timezone=True)), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
        for column in ("assignment_key", "experiment_id", "variant_id", "user_id", "anonymous_id"):
            op.create_index(f"ix_experiment_assignments_{column}", "experiment_assignments", [column], unique=column == "assignment_key")
    if "analytics_daily" not in tables:
        op.create_table("analytics_daily", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("metric_date", sa.Date(), nullable=False),
            sa.Column("dimension_type", sa.String(40), nullable=False, server_default="all"), sa.Column("dimension_value", sa.String(160), nullable=False, server_default="all"),
            sa.Column("metrics_json", sa.Text(), nullable=False, server_default="{}"), sa.Column("updated_at", sa.DateTime(timezone=True)),
            sa.UniqueConstraint("metric_date", "dimension_type", "dimension_value", name="uq_analytics_daily_dimension"))
        op.create_index("ix_analytics_daily_metric_date", "analytics_daily", ["metric_date"])

    op.execute("INSERT OR IGNORE INTO app_settings (key, value, created_at) VALUES ('analytics_v2_baseline', datetime('now'), datetime('now'))")
    if "notifications" in tables:
        bind.exec_driver_sql("""
            INSERT INTO campaigns (
                name, placement, title, body, button_text, button_url, audience_json,
                status, starts_at, ends_at, frequency_cap, holdout_pct, goal_event,
                created_by, updated_at, created_at
            )
            SELECT
                'legacy-notification-' || id, 'notification', title, text,
                COALESCE(button_text, ''), COALESCE(button_url, ''),
                CASE audience
                    WHEN 'paid' THEN '{"paid":true}'
                    WHEN 'zero_balance' THEN '{"balance_lte":0}'
                    WHEN 'new' THEN '{"max_requests":0}'
                    WHEN 'specific_user' THEN '{"user_ids":[' || audience_user_id || ']}'
                    ELSE '{}'
                END,
                CASE WHEN is_active = 1 THEN 'active' ELSE 'paused' END,
                starts_at, ends_at, 1, 10, 'result_success', created_by,
                CURRENT_TIMESTAMP, created_at
            FROM notifications
        """)
        op.execute("UPDATE notifications SET is_active = 0")


def downgrade() -> None:
    for table in ("analytics_daily", "experiment_assignments", "experiment_variants", "experiments", "reward_ledger", "user_achievements", "user_mission_progress", "user_progress", "achievements", "missions", "survey_responses", "survey_questions", "surveys", "campaign_deliveries", "campaigns", "saved_segments"):
        op.drop_table(table)
