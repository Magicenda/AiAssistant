from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class YandexConnectRequest(BaseModel):
    login: str = Field(min_length=3, max_length=255, description="Email Яндекса")
    app_password: str = Field(min_length=4, max_length=128, description="Пароль приложения «Календарь»")


class YandexCalendarStatus(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    connected: bool
    login: str | None = None
    connected_at: datetime | None = None
