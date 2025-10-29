import os
from dotenv import load_dotenv

# Load all variables from .env file into environment
load_dotenv()


class Config:
    # Load configuration variables
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///sentinelid.db")
    SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
    DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")
    MODEL_NAME = os.getenv("MODEL_NAME", "google/gemma-3n-e2b-it:free")


# Create a single config instance
config = Config()
