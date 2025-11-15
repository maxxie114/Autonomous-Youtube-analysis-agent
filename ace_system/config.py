import os
from pathlib import Path

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    """Application configuration with environment variable support."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Agent configuration
    agent_dir: str = Field(
        default_factory=lambda: str(Path(__file__).parent / "agents")
    )
    serve_web_interface: bool = Field(default=True)
    reload_agents: bool = Field(default=True)

    # Model configuration
    generator_model: str = Field(default="gemini-2.5-flash")
    reflector_model: str = Field(default="gemini-2.5-flash")
    curator_model: str = Field(default="gemini-2.5-flash")

    # API configuration
    google_api_key: str | None = Field(default=None, alias="GOOGLE_API_KEY")
    google_genai_use_vertexai: bool = Field(
        default=False, alias="GOOGLE_GENAI_USE_VERTEXAI"
    )