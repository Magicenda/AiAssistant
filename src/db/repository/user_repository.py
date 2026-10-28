from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import User


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_username(self, username: str) -> User | None:
        result = await self.session.execute(select(User).where(User.username == username))
        return result.scalars().first()

    async def get_or_create(self, username: str) -> User:
        user = await self.get_by_username(username)
        if user is None:
            user = User(username=username)
            self.session.add(user)
            await self.session.flush()
        return user
