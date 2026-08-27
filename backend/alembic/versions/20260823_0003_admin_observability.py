"""Add searchable prompts, feedback and runtime settings."""

import json

from alembic import op
import sqlalchemy as sa


revision = "20260823_0003"
down_revision = "20260821_0002"
branch_labels = None
depends_on = None


def _prompt_text(content) -> tuple[str, bool]:
    if isinstance(content, str):
        return content, False
    if not isinstance(content, list):
        return str(content or ""), False
    texts = []
    attachments = False
    for part in content:
        if not isinstance(part, dict):
            continue
        if part.get("type") == "text":
            texts.append(str(part.get("text", "")))
        elif part.get("type") in {"image_url", "video_url", "file"}:
            attachments = True
    return "\n".join(texts).strip(), attachments


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())

    if "user_queries" not in tables:
        op.create_table(
            "user_queries",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("session_id", sa.String(36), sa.ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("message_index", sa.Integer(), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("model", sa.String(200), nullable=True),
            sa.Column("has_attachments", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("session_id", "message_index", name="uq_user_queries_session_message"),
        )
        op.create_index("ix_user_queries_session_id", "user_queries", ["session_id"])
        op.create_index("ix_user_queries_user_id", "user_queries", ["user_id"])
        op.create_index("ix_user_queries_model", "user_queries", ["model"])

        sessions = bind.execute(sa.text("SELECT id, user_id, messages FROM chat_sessions")).mappings()
        for session in sessions:
            try:
                messages = json.loads(session["messages"] or "[]")
            except (json.JSONDecodeError, TypeError):
                continue
            for index, message in enumerate(messages):
                if not isinstance(message, dict) or message.get("role") != "user":
                    continue
                content, attachments = _prompt_text(message.get("content", ""))
                next_message = messages[index + 1] if index + 1 < len(messages) else {}
                model = (
                    message.get("effective_model")
                    or message.get("requested_model")
                    or (next_message.get("effective_model") if isinstance(next_message, dict) else None)
                    or (next_message.get("requested_model") if isinstance(next_message, dict) else None)
                )
                bind.execute(sa.text(
                    "INSERT INTO user_queries "
                    "(session_id, user_id, message_index, content, model, has_attachments, created_at) "
                    "VALUES (:session_id, :user_id, :message_index, :content, :model, :attachments, CURRENT_TIMESTAMP)"
                ), {
                    "session_id": session["id"], "user_id": session["user_id"],
                    "message_index": index, "content": content, "model": model,
                    "attachments": attachments,
                })

    if "message_feedback" not in tables:
        op.create_table(
            "message_feedback",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("session_id", sa.String(36), nullable=False),
            sa.Column("message_index", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("feedback_type", sa.String(20), nullable=False),
            sa.Column("model", sa.String(200), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("session_id", "message_index", "user_id", name="uq_message_feedback_target"),
        )
        op.create_index("ix_message_feedback_session_id", "message_feedback", ["session_id"])
        op.create_index("ix_message_feedback_user_id", "message_feedback", ["user_id"])
        op.create_index("ix_message_feedback_feedback_type", "message_feedback", ["feedback_type"])
        op.create_index("ix_message_feedback_model", "message_feedback", ["model"])

    if "user_feedback" not in tables:
        op.create_table(
            "user_feedback",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("type", sa.String(20), nullable=False, server_default="other"),
            sa.Column("subject", sa.String(255), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("rating", sa.Integer(), nullable=True),
            sa.Column("source", sa.String(50), nullable=False, server_default="site"),
            sa.Column("status", sa.String(20), nullable=False, server_default="new"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_user_feedback_user_id", "user_feedback", ["user_id"])
        op.create_index("ix_user_feedback_type", "user_feedback", ["type"])
        op.create_index("ix_user_feedback_status", "user_feedback", ["status"])

    if "feedback_replies" not in tables:
        op.create_table(
            "feedback_replies",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("feedback_id", sa.Integer(), sa.ForeignKey("user_feedback.id", ondelete="CASCADE"), nullable=False),
            sa.Column("admin_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_feedback_replies_feedback_id", "feedback_replies", ["feedback_id"])

    if "app_settings" not in tables:
        op.create_table(
            "app_settings",
            sa.Column("key", sa.String(100), primary_key=True),
            sa.Column("value", sa.Text(), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade() -> None:
    # Customer prompts and feedback are intentionally preserved on code rollback.
    pass
