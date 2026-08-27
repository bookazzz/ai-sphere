"""Product analytics, engagement, experimentation and gamification entities."""

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class SavedSegment(Base, TimestampMixin):
    __tablename__ = "saved_segments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    filters_json: Mapped[str] = mapped_column(Text, default="{}")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class Campaign(Base, TimestampMixin):
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    placement: Mapped[str] = mapped_column(String(30), default="notification")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    button_text: Mapped[str] = mapped_column(String(100), default="")
    button_url: Mapped[str] = mapped_column(String(500), default="")
    segment_id: Mapped[int | None] = mapped_column(ForeignKey("saved_segments.id", ondelete="SET NULL"), index=True)
    audience_json: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    frequency_cap: Mapped[int] = mapped_column(Integer, default=1)
    holdout_pct: Mapped[int] = mapped_column(Integer, default=10)
    goal_event: Mapped[str] = mapped_column(String(50), default="payment_succeeded")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CampaignDelivery(Base, TimestampMixin):
    __tablename__ = "campaign_deliveries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    delivery_key: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    anonymous_id: Mapped[str] = mapped_column(String(80), default="", index=True)
    is_holdout: Mapped[bool] = mapped_column(Boolean, default=False)
    impression_count: Mapped[int] = mapped_column(Integer, default=0)
    first_shown_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_shown_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    clicked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    converted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Survey(Base, TimestampMixin):
    __tablename__ = "surveys"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    trigger_event: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    is_critical: Mapped[bool] = mapped_column(Boolean, default=False)
    frequency_days: Mapped[int] = mapped_column(Integer, default=14)


class SurveyQuestion(Base, TimestampMixin):
    __tablename__ = "survey_questions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    survey_id: Mapped[int] = mapped_column(ForeignKey("surveys.id", ondelete="CASCADE"), index=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(String(20), default="single")
    options_json: Mapped[str] = mapped_column(Text, default="[]")
    sort_order: Mapped[int] = mapped_column(Integer, default=100)


class SurveyResponse(Base, TimestampMixin):
    __tablename__ = "survey_responses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    survey_id: Mapped[int] = mapped_column(ForeignKey("surveys.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("survey_questions.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    anonymous_id: Mapped[str] = mapped_column(String(80), default="", index=True)
    visit_session_id: Mapped[str] = mapped_column(String(80), default="", index=True)
    answer: Mapped[str] = mapped_column(Text, nullable=False)


class Mission(Base, TimestampMixin):
    __tablename__ = "missions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    criteria_json: Mapped[str] = mapped_column(Text, default="{}")
    reward_credits: Mapped[int] = mapped_column(Integer, default=0)
    reward_xp: Mapped[int] = mapped_column(Integer, default=0)
    period: Mapped[str] = mapped_column(String(20), default="lifetime")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=100)


class Achievement(Base, TimestampMixin):
    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    icon: Mapped[str] = mapped_column(String(40), default="✦")
    criteria_json: Mapped[str] = mapped_column(Text, default="{}")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class UserProgress(Base):
    __tablename__ = "user_progress"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[str] = mapped_column(String(30), default="Новичок")
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    last_active_date: Mapped[date | None] = mapped_column(Date)
    monthly_bonus_credits: Mapped[int] = mapped_column(Integer, default=0)
    bonus_month: Mapped[str] = mapped_column(String(7), default="")
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class UserMissionProgress(Base, TimestampMixin):
    __tablename__ = "user_mission_progress"
    __table_args__ = (UniqueConstraint("user_id", "mission_id", "period_key", name="uq_user_mission_period"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    mission_id: Mapped[int] = mapped_column(ForeignKey("missions.id", ondelete="CASCADE"), index=True)
    period_key: Mapped[str] = mapped_column(String(20), default="lifetime")
    current_value: Mapped[int] = mapped_column(Integer, default=0)
    progress_json: Mapped[str] = mapped_column(Text, default="{}")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rewarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class UserAchievement(Base, TimestampMixin):
    __tablename__ = "user_achievements"
    __table_args__ = (UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    achievement_id: Mapped[int] = mapped_column(ForeignKey("achievements.id", ondelete="CASCADE"), index=True)


class RewardLedger(Base, TimestampMixin):
    __tablename__ = "reward_ledger"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    reward_key: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False)
    source_id: Mapped[str] = mapped_column(String(100), default="")
    xp_amount: Mapped[int] = mapped_column(Integer, default=0)
    credit_amount: Mapped[int] = mapped_column(Integer, default=0)
    detail_json: Mapped[str] = mapped_column(Text, default="{}")


class Experiment(Base, TimestampMixin):
    __tablename__ = "experiments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    surface: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    primary_metric: Mapped[str] = mapped_column(String(50), default="activation")
    guardrails_json: Mapped[str] = mapped_column(Text, default="[]")
    winner_variant_id: Mapped[int | None] = mapped_column(Integer)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)


class ExperimentVariant(Base, TimestampMixin):
    __tablename__ = "experiment_variants"
    __table_args__ = (UniqueConstraint("experiment_id", "key", name="uq_experiment_variant_key"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    experiment_id: Mapped[int] = mapped_column(ForeignKey("experiments.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    weight: Mapped[float] = mapped_column(Float, default=0.5)


class ExperimentAssignment(Base, TimestampMixin):
    __tablename__ = "experiment_assignments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    assignment_key: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    experiment_id: Mapped[int] = mapped_column(ForeignKey("experiments.id", ondelete="CASCADE"), index=True)
    variant_id: Mapped[int] = mapped_column(ForeignKey("experiment_variants.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    anonymous_id: Mapped[str] = mapped_column(String(80), default="", index=True)
    exposed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AnalyticsDaily(Base):
    __tablename__ = "analytics_daily"
    __table_args__ = (UniqueConstraint("metric_date", "dimension_type", "dimension_value", name="uq_analytics_daily_dimension"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    metric_date: Mapped[date] = mapped_column(Date, index=True)
    dimension_type: Mapped[str] = mapped_column(String(40), default="all")
    dimension_value: Mapped[str] = mapped_column(String(160), default="all")
    metrics_json: Mapped[str] = mapped_column(Text, default="{}")
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
