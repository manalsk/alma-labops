from pydantic import field_validator
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

    # Accepts a comma-separated string or a JSON array in .env
    # e.g. ALLOWED_ORIGINS=http://localhost:3000,https://myapp.vercel.app
    allowed_origins: str = "http://localhost:3000"
    environment: str = "development"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()
