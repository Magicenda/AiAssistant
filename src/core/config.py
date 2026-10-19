from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    database_url: str = "postgresql+asyncpg://app:app@localhost:5432/tickets" # Изменить строку подключения к базе данных на асинхронную версию
    anthropic_api_key: str
    llm_model: str = "claude-sonnet-5-5" # Поменять на модель, которую вы хотите использовать
    agent_max_steps: int = 5


settings = Settings()