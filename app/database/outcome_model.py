from sqlalchemy import String, Integer, DateTime, Boolean, Float, JSON, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base

from .market_model import Markets


class Outcomes(Base):
    __tablename__ = "Outcomes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    marketId: Mapped[int] = mapped_column(
        ForeignKey("Markets.id", ondelete="CASCADE"),
        nullable=False
    )

    teamId: Mapped[int] = mapped_column(
        ForeignKey("Teams.id"),
        nullable=True
    )

    name: Mapped[str] = mapped_column(String, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    impliedProbability: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    point: Mapped[float] = mapped_column(Float, nullable=True)

    # relationships
    market: Mapped["Markets"] = relationship(
        "Markets",
        back_populates="outcomes"
    )

    teams: Mapped["Teams"] = relationship("Teams")

    __table_args__ = (
        Index("ix_outcome_market_name", "marketId", "name", unique=True),
    )
