from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://spendigo:password@localhost:5432/spendigo_db"
    SECRET_KEY: str = "spendigo-dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    FRONTEND_URL: Optional[str] = None  # For Railway deployment
    OPENAI_API_KEY: Optional[str] = None  # For Spen AI Chat

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
