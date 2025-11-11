from __future__ import annotations
from typing import Any, Dict, List, Optional, Annotated
from datetime import datetime
from enum import Enum

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import ForeignKey, String, Integer, Boolean, Text, Float, JSON, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pydantic import BaseModel, Field, constr, conint, confloat


db: SQLAlchemy = SQLAlchemy()

# --------------------------------------------------------------------------
# 🧩 SQLAlchemy ORM MODELS (typed)
# --------------------------------------------------------------------------

class User(db.Model):
    """
    SQLAlchemy User model with full typing and a constructor
    that enables IDE autocompletion and type safety.
    """
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # Relationships
    aliases: Mapped[List["Alias"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    sessions: Mapped[List["Session"]] = relationship(back_populates="user", cascade="all, delete-orphan")

    def __init__(
        self,
        *,
        username: str,
        email: str,
        password_hash: Optional[str] = None,
    ) -> None:
        """
        Typed constructor for IDE support.
        Required: username, email
        Optional: password_hash
        """
        self.username = username
        self.email = email
        self.password_hash = password_hash

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username!r} email={self.email!r}>"


class Alias(db.Model):
    __tablename__ = "alias"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"), nullable=False)
    alias_email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    generated_password: Mapped[Optional[str]] = mapped_column(String(128))
    site_name: Mapped[Optional[str]] = mapped_column(String(100))
    group_name: Mapped[Optional[str]] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=db.func.current_timestamp())

    user: Mapped["User"] = relationship(back_populates="aliases")
    leaks: Mapped[List["Leak"]] = relationship(back_populates="alias")

    def __init__(
        self,
        *,
        user_id: int,
        alias_email: str,
        generated_password: Optional[str] = None,
        site_name: Optional[str] = None,
        group_name: Optional[str] = None,
    ) -> None:
        """Type-safe constructor for IDE autocompletion."""
        self.user_id = user_id
        self.alias_email = alias_email
        self.generated_password = generated_password
        self.site_name = site_name
        self.group_name = group_name



class Leak(db.Model):
    """
    Leak model — represents a detected data breach linked to an alias.
    Includes strong typing, IDE autocompletion, and full ORM relationship support.
    """
    __tablename__ = "leak"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    alias_id: Mapped[Optional[int]] = mapped_column(ForeignKey("alias.id"), nullable=True)
    breach_source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=db.func.current_timestamp())

    # Relationships
    alias: Mapped[Optional["Alias"]] = relationship(back_populates="leaks")
    correlations: Mapped[List["IncidentCorrelation"]] = relationship(
        back_populates="leak",
        cascade="all, delete-orphan"
    )

    def __init__(
        self,
        *,
        alias_id: Optional[int] = None,
        breach_source: Optional[str] = None,
        detected_at: Optional[datetime] = None,
    ) -> None:
        """
        Typed constructor for Leak.
        All parameters optional since leaks can be dynamically created.
        """
        self.alias_id = alias_id
        self.breach_source = breach_source
        self.detected_at = detected_at or datetime.utcnow()

    def __repr__(self) -> str:
        return f"<Leak id={self.id} alias_id={self.alias_id} source={self.breach_source!r}>"


class Session(db.Model):
    """
    Represents a user browsing or monitoring session.
    Type-safe model with explicit constructor and relationships.
    """
    __tablename__ = "session"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime, default=db.func.current_timestamp())
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship(back_populates="sessions")
    tabs: Mapped[List["SessionTab"]] = relationship(back_populates="session", cascade="all, delete-orphan")

    def __init__(
        self,
        *,
        user_id: int,
        start_time: datetime | None = None,
        active: bool = True,
    ) -> None:
        self.user_id = user_id
        self.start_time = start_time or datetime.utcnow()
        self.active = active

    def __repr__(self) -> str:
        return f"<Session id={self.id} user_id={self.user_id} active={self.active}>"


class SessionTab(db.Model):
    __tablename__ = "session_tab"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("session.id"), nullable=False)

    url: Mapped[str] = mapped_column(String(512), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)

    # ✅ FIXED: allow a list of cookies
    cookies: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, nullable=True)
    local_storage: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_accessed: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    session: Mapped["Session"] = relationship(back_populates="tabs")

    def __init__(
        self,
        *,
        session_id: int,
        url: str,
        title: Optional[str] = None,
        cookies: Optional[List[Dict[str, Any]]] = None,
        local_storage: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.session_id = session_id
        self.url = url
        self.title = title
        self.cookies = cookies
        self.local_storage = local_storage
        
class IncidentCorrelation(db.Model):
    """
    Represents correlation data between a leak and a user session.
    Tracks confidence and contributing factors.
    """
    __tablename__ = "incident_correlation"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    leak_id: Mapped[int] = mapped_column(ForeignKey("leak.id"), nullable=False)
    session_id: Mapped[Optional[int]] = mapped_column(ForeignKey("session.id"), nullable=True)
    alias_id: Mapped[Optional[int]] = mapped_column(ForeignKey("alias.id"), nullable=True)
    correlation_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    correlation_factors: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=True)
    correlated_at: Mapped[datetime] = mapped_column(DateTime, default=db.func.current_timestamp())
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    leak: Mapped["Leak"] = relationship(back_populates="correlations")

    def __init__(
        self,
        *,
        leak_id: int,
        session_id: Optional[int] = None,
        alias_id: Optional[int] = None,
        correlation_confidence: float = 0.0,
        correlation_factors: Optional[Dict[str, Any]] = None,
        is_resolved: bool = False,
        resolution_notes: Optional[str] = None,
    ) -> None:
        self.leak_id = leak_id
        self.session_id = session_id
        self.alias_id = alias_id
        self.correlation_confidence = correlation_confidence
        self.correlation_factors = correlation_factors or {}
        self.is_resolved = is_resolved
        self.resolution_notes = resolution_notes

    def __repr__(self) -> str:
        return f"<IncidentCorrelation id={self.id} leak_id={self.leak_id} confidence={self.correlation_confidence}>"

# --------------------------------------------------------------------------
# 🧠 ENUMS & Pydantic MODELS (runtime validation)
# --------------------------------------------------------------------------

class UserChoice(str, Enum):
    """Enumeration for possible user actions in AI decision logs."""
    ALLOW = "ALLOW"
    BLOCK = "BLOCK"
    SPOOF = "SPOOF"


class ChoiceLog(BaseModel):
    """Pydantic model for incoming user choice logs."""
    user_id: Annotated[str, Field(..., description="Unique user ID.")]
    session_id: Annotated[str, Field(..., description="Associated session ID.")]
    choice: UserChoice = Field(..., description="User decision outcome.")
    features: Dict[str, Any] = Field(..., description="Behavioral feature data.")


# --------------------------------------------------------------------------
# 🔐 Breach / Security Models
# --------------------------------------------------------------------------

class BreachDetail(BaseModel):
    AddedDate: Annotated[str, Field(...)]
    Attribution: Optional[str]
    BreachDate: Annotated[str, Field(...)]
    DataClasses: Annotated[List[str], Field(...)]
    Description: Annotated[str, Field(...)]
    DisclosureUrl: Optional[str]
    Domain: Annotated[str, Field(...)]
    IsFabricated: Annotated[bool, Field(...)]
    IsMalware: Annotated[bool, Field(...)]
    IsRetired: Annotated[bool, Field(...)]
    IsSensitive: Annotated[bool, Field(...)]
    IsSpamList: Annotated[bool, Field(...)]
    IsStealerLog: Annotated[bool, Field(...)]
    IsSubscriptionFree: Annotated[bool, Field(...)]
    IsVerified: Annotated[bool, Field(...)]
    LogoPath: Optional[str]
    ModifiedDate: Annotated[str, Field(...)]
    Name: Annotated[str, Field(...)]
    PwnCount: Annotated[int, Field(gt=-1)]
    Title: Annotated[str, Field(...)]


class BreachAction(str, Enum):
    REPLACE_PASSWORD = "replace_password"
    REVIEW_ACCOUNT = "review_account"
    ALERT_ONLY = "alert_only"


class BreachStatus(str, Enum):
    SAFE = "SAFE"
    COMPROMISED = "COMPROMISED"
    ERROR = "ERROR"


class BreachReport(BaseModel):
    action: BreachAction
    breach_count: Annotated[int, Field(..., ge=0)]
    breaches: Annotated[List[str], Field(...)]
    details: Annotated[List[BreachDetail], Field(...)]
    status: BreachStatus


class PasswordStatus(str, Enum):
    PWNED = "PWNED"
    SAFE = "SAFE"
    ERROR = "ERROR"


class PasswordBreachResponse(BaseModel):
    count: Annotated[int, Field(..., ge=0)]
    message: Annotated[str, Field(...)]
    status: PasswordStatus
