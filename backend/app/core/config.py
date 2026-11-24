from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "sqlite:///./jobportal.db"
    secret_key: str = "CHANGE_THIS_DEVELOPMENT_SECRET_BEFORE_DEPLOYMENT"
    access_token_expire_minutes: int = 60
    upload_dir: str = "uploads"
    cors_origins: str = "http://localhost:5173"
    admin_email: str = ""
    admin_password: str = ""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
