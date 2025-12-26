from sqlalchemy import String, Integer, DateTime, Boolean, Float, JSON, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base

from .valueBetSettings_model import ValueBetSettings
from .mlModelWeights import MlModelWeights
from .hyperParameters_model import HyperParameters


class Sports(Base):
    __tablename__ = "Sports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    espnSport: Mapped[str] = mapped_column(String, nullable=False)
    league: Mapped[str] = mapped_column(String, nullable=False)

    startMonth: Mapped[int] = mapped_column(Integer, nullable=False)
    endMonth: Mapped[int] = mapped_column(Integer, nullable=False)
    multiYear: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    statYear: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    prevStatYear: Mapped[int] = mapped_column(Integer, nullable=True)

    # NEW added
    variance: Mapped[float] = mapped_column(Float, nullable=True)
    calibrationECE: Mapped[float] = mapped_column(Float, nullable=True)
    reliabilityWeight: Mapped[float] = mapped_column(Float, nullable=True)
    threshold: Mapped[float] = mapped_column(Float, nullable=True)
    # optimalBettingStrategy: Mapped[str] = mapped_column(String, nullable=True)
    # kelleyPct: Mapped[float] = mapped_column(Float, nullable=True)

    # relationships
    games: Mapped[list["Games"]] = relationship("Games", foreign_keys="[Games.sport]", cascade="all, delete-orphan")
    valueBetSettings: Mapped[list["ValueBetSettings"]] = relationship("ValueBetSettings", cascade="all, delete-orphan")
    mlModelWeights: Mapped["MlModelWeights"] = relationship("MlModelWeights", foreign_keys="[MlModelWeights.sport]", cascade="all, delete-orphan")
    hyperParameters: Mapped["HyperParameters"] = relationship("HyperParameters", foreign_keys="[HyperParameters.sport]", cascade="all, delete-orphan")
