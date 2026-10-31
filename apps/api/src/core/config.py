from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[2]


def _resolve_monorepo_root() -> Path:
    """Ищет корень монорепы — папку с `package.json` и `apps/`.

    Нужен, потому что единый `.env` лежит там, а не в `apps/api`.
    В образе приложение лежит в `/app` и корня монорепы нет — тогда
    возвращается `ROOT_DIR`, а переменные приходят из Docker Compose.
    """
    for parent in ROOT_DIR.parents:
        if (parent / "package.json").is_file() and (parent / "apps").is_dir():
            return parent
    return ROOT_DIR


MONOREPO_ROOT = _resolve_monorepo_root()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Единый .env в корне монорепы; apps/api/.env (как в README) перекрывает его.
        env_file=(MONOREPO_ROOT / ".env", ROOT_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str
    agent_max_steps: int = 5
    history_limit: int = 20
    # секрет для подписи токенов: openssl rand -hex 32
    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    llm_provider: Literal["gigachat", "openai_compatible"] = "gigachat"
    llm_base_url: str = "http://localhost:11434/v1"
    llm_api_key: str = "ollama"
    llm_model: str = ""
    llm_timeout: float = 120.0

    # GigaChat: SDK умеет читать эти переменные сам, но дефолты держим здесь,
    # чтобы они не дублировались в .env-файлах.
    gigachat_credentials: str = ""
    gigachat_scope: str = "GIGACHAT_API_PERS"
    gigachat_model: str = "GigaChat-2"
    gigachat_verify_ssl_certs: bool = False
    gigachat_max_retries: int = Field(default=1, ge=0, le=3)


settings = Settings()
