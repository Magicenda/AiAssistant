from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm

from core.security import create_access_token
from deps import AuthServiceDep, CurrentUserDep
from schemas.auth import RegisterRequest, TokenResponse, UserOut


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
async def register(payload: RegisterRequest, service: AuthServiceDep) -> UserOut:
    return await service.register(payload.username, payload.password)


@router.post("/login", response_model=TokenResponse)
async def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()], service: AuthServiceDep
) -> TokenResponse:
    user = await service.authenticate(form.username, form.password)
    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
async def get_me(user: CurrentUserDep) -> UserOut:
    return user
