from datetime import datetime

from pydantic import BaseModel, ConfigDict


class YandexAuthorizeResponse(BaseModel):
    authorize_url: str


class YandexCalendarStatus(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    connected: bool
    login: str | None = None
    connected_at: datetime | None = None
