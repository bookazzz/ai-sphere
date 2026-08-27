import os
import sqlite3
import subprocess
import sys
from pathlib import Path

import bcrypt


BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_baseline_migration_preserves_legacy_users_and_rotates_oauth_password(tmp_path):
    database = tmp_path / "legacy.db"
    legacy_password = "oauth_yandex_12345"
    with sqlite3.connect(database) as connection:
        connection.execute(
            "CREATE TABLE users ("
            "id INTEGER PRIMARY KEY, email VARCHAR(255) NOT NULL, hashed_password VARCHAR(255) NOT NULL, "
            "total_spent_rub INTEGER NOT NULL DEFAULT 0, yandex_id VARCHAR(100), vk_id VARCHAR(100))"
        )
        connection.execute(
            "INSERT INTO users (id, email, hashed_password, total_spent_rub, yandex_id) VALUES (?, ?, ?, ?, ?)",
            (1, "legacy@example.com", bcrypt.hashpw(legacy_password.encode(), bcrypt.gensalt()).decode(), 12345, "12345"),
        )
        connection.commit()

    env = os.environ.copy()
    env.update({
        "AISPHERE_DATA_DIR": str(tmp_path),
        "AISPHERE_DATABASE_URL": f"sqlite+aiosqlite:///{database.as_posix()}",
        "AISPHERE_DATABASE_URL_SYNC": f"sqlite:///{database.as_posix()}",
        "AISPHERE_ENVIRONMENT": "development",
        "PYTHONPATH": os.pathsep.join((str(BACKEND_DIR), str(BACKEND_DIR.parent / ".tmp-backend-deps"))),
    })
    migration_command = (
        "from alembic.config import Config; from alembic import command; "
        f"command.upgrade(Config(r'{BACKEND_DIR / 'alembic.ini'}'), 'head')"
    )
    subprocess.run(
        [sys.executable, "-c", migration_command],
        cwd=BACKEND_DIR,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )

    with sqlite3.connect(database) as connection:
        row = connection.execute("SELECT hashed_password, total_paid_rub FROM users WHERE id = 1").fetchone()
        assert connection.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM payment_attempts").fetchone()[0] == 0
        tables = {item[0] for item in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        model_columns = {item[1] for item in connection.execute("PRAGMA table_info(ai_models)")}
        assert "generation_jobs" in tables
        assert {"input_modalities", "output_modalities", "supported_parameters", "openrouter_pricing", "auto_route_enabled"} <= model_columns
    assert row[1] == 12345
    assert row[0].startswith("$argon2")
