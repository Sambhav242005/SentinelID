from flask_sqlalchemy import SQLAlchemy
from config import config

from pydantic import BaseModel, Field
from enum import Enum

db = SQLAlchemy()


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))


class Alias(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    alias_email = db.Column(db.String(120), unique=True, nullable=False)
    generated_password = db.Column(db.String(128))
    site_name = db.Column(db.String(100))
    group_name = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())


class Leak(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    alias_id = db.Column(db.Integer, db.ForeignKey("alias.id"))
    breach_source = db.Column(db.String(100))
    detected_at = db.Column(db.DateTime, default=db.func.current_timestamp())


class Session(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    start_time = db.Column(db.DateTime, default=db.func.current_timestamp())
    active = db.Column(db.Boolean, default=True)


class SessionTab(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("session.id"))
    url = db.Column(db.String(200))
    cookies = db.Column(db.Text)
    local_storage = db.Column(db.Text)


# --- Data Models ---
class UserChoice(str, Enum):
    """Enumeration for the possible user choices."""

    ALLOW = "ALLOW"
    BLOCK = "BLOCK"
    SPOOF = "SPOOF"


class ChoiceLog(BaseModel):
    """
    Pydantic model to validate incoming log data.
    """

    user_id: str = Field(..., description="The unique identifier for the user.")
    session_id: str = Field(..., description="The session this action occurred in.")
    choice: UserChoice = Field(..., description="The user's decision.")

    features: Dict[str, Any] = Field(
        ..., description="Feature vector of the detected behavior."
    )
