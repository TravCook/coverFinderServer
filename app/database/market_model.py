from sqlalchemy import String, Integer, DateTime, Boolean, Float, JSON, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base

from .bookmaker_model import Bookmakers

class Markets(Base):
    __tablename__ = "Markets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    bookmakerId: Mapped[int] = mapped_column(
        ForeignKey("Bookmakers.id", ondelete="CASCADE"),
        nullable=False
    )

    key: Mapped[str] = mapped_column(String, nullable=False)

    # relationships
    bookmaker: Mapped["Bookmakers"] = relationship(
        "Bookmakers",
        back_populates="markets"
    )

    outcomes: Mapped[list["Outcomes"]] = relationship(
        "Outcomes",
        back_populates="market",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_market_bookmaker_key", "bookmakerId", "key", unique=True),
    )
