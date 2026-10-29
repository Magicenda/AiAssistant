import asyncio

from core.exceptions import InvalidCredentialsError, UserAlreadyExistsError
from core.security import hash_password, verify_dummy_password, verify_password
from db.models import User
from db.repository.user_repository import UserRepository


class AuthService:
    def __init__(self, users: UserRepository):
        self.users = users

    async def register(self, username: str, password: str) -> User:
        username = username.lower()
        if await self.users.get_by_username(username):
            raise UserAlreadyExistsError(username)
        # хэширование argon2 синхронное и дорогое: в отдельном потоке, чтобы не блокировать event loop
        hashed = await asyncio.to_thread(hash_password, password)
        return await self.users.create_user(username, hashed)

    async def authenticate(self, username: str, password: str) -> User:
        user = await self.users.get_by_username(username.lower())
        if user is None:
            await asyncio.to_thread(verify_dummy_password, password)
            raise InvalidCredentialsError()
        if not await asyncio.to_thread(verify_password, password, user.hashed_password):
            raise InvalidCredentialsError()
        return user
