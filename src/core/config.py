from pydantic_settings import BaseSettings, SettingsConfigDict
import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str
    agent_max_steps: int = 5
    history_limit: int = 20


settings = Settings()