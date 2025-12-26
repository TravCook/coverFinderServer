from sqlalchemy import String, Integer, DateTime, Boolean, Float, JSON, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class ValueBetSettings(Base):
    __tablename__ = "ValueBetSettings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # FK
    sport: Mapped[int] = mapped_column(ForeignKey("Sports.id"), nullable=False)

    # NEW SEGMENT FIELDS
    segmentKey: Mapped[str] = mapped_column(String, nullable=False)
    segmentJsCondition: Mapped[str] = mapped_column(String, nullable=False)
    segmentVariance: Mapped[float] = mapped_column(Float, nullable=False)
    segmentReliability: Mapped[float] = mapped_column(Float, nullable=False)
    segmentThreshold: Mapped[float] = mapped_column(Float, nullable=False)
    sampleSize: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (
        Index('ix_segment_sport_unique', 'segmentKey', 'sport', unique=True),
    )
