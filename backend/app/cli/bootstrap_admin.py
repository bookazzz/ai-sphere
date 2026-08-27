"""Create or promote the first super-administrator."""

import argparse
import asyncio
from getpass import getpass

from sqlalchemy import select

from app.core.database import async_session
from app.core.security import hash_password
from app.models.user import User


async def bootstrap(email: str, name: str | None, reset_password: bool = False) -> None:
    async with async_session() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if user is None or reset_password:
            password = getpass("New administrator password: ")
            confirmation = getpass("Repeat password: ")
            if password != confirmation or len(password) < 12:
                raise SystemExit("Passwords must match and contain at least 12 characters")
            if user is None:
                user = User(email=email, name=name, hashed_password=hash_password(password), is_admin=True)
                db.add(user)
            else:
                user.hashed_password = hash_password(password)
        if user is not None:
            user.is_admin = True
            user.role_id = None
        await db.commit()
        print(f"Super-administrator ready: {email}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("email")
    parser.add_argument("--name")
    parser.add_argument("--reset-password", action="store_true")
    args = parser.parse_args()
    asyncio.run(bootstrap(args.email, args.name, args.reset_password))


if __name__ == "__main__":
    main()
