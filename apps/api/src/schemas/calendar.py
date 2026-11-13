from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class YandexAuthorizeResponse(BaseModel):
    authorize_url: str


class YandexCalendarStatus(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    connected: bool
    login: str | None = None
    connected_at: datetime | None = None


class YandexSyncResult(BaseModel):
    meetings: int = Field(description="Сколько встреч добавлено в календарь")
    reminders: int = Field(description="Сколько напоминаний добавлено в календарь")
    failed: int = Field(description="Сколько записей не удалось добавить")


class AppleCalendarConnectRequest(BaseModel):
    apple_id: str = Field(..., min_length=3, description="Apple ID (email)")
    app_password: str = Field(..., min_length=8, description="Пароль приложения из Apple ID")

    @field_validator("apple_id")
    @classmethod
    def normalize_apple_id(cls, value: str) -> str:
        return value.strip()

    @field_validator("app_password")
    @classmethod
    def normalize_app_password(cls, value: str) -> str:
        # Apple показывает код как xxxx-xxxx-xxxx-xxxx; пробелы и дефисы допустимы.
        return value.replace(" ", "").strip()


class AppleCalendarStatus(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    connected: bool
    login: str | None = None
    connected_at: datetime | None = None


class AppleSyncResult(BaseModel):
    meetings: int = Field(description="Сколько встреч добавлено в Apple Календарь")
    reminders: int = Field(description="Сколько напоминаний добавлено в Apple Календарь")
    failed: int = Field(description="Сколько записей не удалось добавить")
