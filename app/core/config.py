from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "Living Data Intelligence Platform"
    VERSION: str = "2.1.0"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"
    SECRET_KEY: str
    
    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    DATABASE_URL: str = "sqlite+aiosqlite:///./living_data.db"
    
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    ENABLE_ML_PREDICTIONS: bool = True
    ENABLE_REAL_TIME_ALERTS: bool = True
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()