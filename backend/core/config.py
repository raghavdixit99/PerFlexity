"""Application configuration."""

from pydantic import Field
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings."""
    
    # App info
    app_name: str = "Per-Flex-ity Simplified"
    app_version: str = "2.0.0"
    debug: bool = False
    
    # Server config
    host: str = "127.0.0.1"
    port: int = 8000
    
    # Database
    database_url: str = "sqlite+aiosqlite:///./perflexity.db"
    
    # CORS
    cors_origins: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Search config
    max_search_results: int = 10
    max_passages: int = 20
    search_timeout: float = 10.0
    fetch_timeout: float = 15.0
    
    # SerpAPI config (optional)
    serpapi_key: str = Field(default="", description="SerpAPI key for premium search fallback")
    
    # LLM config
    ollama_base_url: str = "http://localhost:11434"
    llm_model: str = "qwen2.5:3b-instruct-q4_0"
    llm_temperature: float = 0.1
    llm_max_tokens: int = 1024
    
    # CVA config
    enable_cva_by_default: bool = False
    cva_timeout_seconds: int = 3  # Reduced for background processing
    # CVA SLM config (smaller model for fast claim extraction)
    cva_claim_model: str = "qwen2.5:1.5b-instruct"
    cva_temperature: float = 0.1
    cva_max_tokens: int = 300
    
    # LangChain configuration (now the only pipeline)
    langchain_chunk_size: int = 500
    langchain_chunk_overlap: int = 50
    langchain_max_chunks: int = 30
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
_settings: Settings = None


def get_settings() -> Settings:
    """Get application settings."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings