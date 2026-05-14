from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openai_api_key: str
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    allowed_origins: list[str] = ["http://localhost:3000"]
    environment: str = "development"


settings = Settings()
