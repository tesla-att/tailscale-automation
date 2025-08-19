from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_ENV: str = "dev"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    BASE_URL: str = "http://localhost:8000"

    DATABASE_URL: str

    TS_OAUTH_CLIENT_ID: str
    TS_OAUTH_CLIENT_SECRET: str
    TS_TAILNET: str = "-"
    TS_SCOPES: str = "auth_keys devices:core"

    ROTATE_WARN_DAYS: int = 7
    ROTATE_CHECK_INTERVAL_MIN: int = 15

    ENCRYPTION_KEY: str

    TELEGRAM_BOT_TOKEN: str | None = None
    TELEGRAM_CHAT_ID: str | None = None
    DISCORD_WEBHOOK_URL: str | None = None

    class Config:
        env_file = ".env"

settings = Settings()
