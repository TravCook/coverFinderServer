from sqlalchemy import String, Integer, DateTime, Boolean, Float, JSON, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base

from .outcome_model import Outcomes

class Teams(Base):
    __tablename__ = "Teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    teamName: Mapped[str] = mapped_column(String, nullable=False)
    lightLogo: Mapped[str] = mapped_column(String, nullable=True)
    darkLogo: Mapped[str] = mapped_column(String, nullable=True)
    league: Mapped[str] = mapped_column(String, nullable=False)
    espnID: Mapped[int] = mapped_column(Integer, nullable=False)
    abbreviation: Mapped[str] = mapped_column(String, nullable=False)
    espnDisplayName: Mapped[str] = mapped_column(String, nullable=True)
    mainColor: Mapped[str] = mapped_column(String, nullable=True)
    secondaryColor: Mapped[str] = mapped_column(String, nullable=True)
    currentStats: Mapped[JSON] = mapped_column(JSON, nullable=True)
    espnLeague: Mapped[str] = mapped_column(String, nullable=True)
    statIndex: Mapped[float] = mapped_column(Float, nullable=True)
    scaledStatIndex: Mapped[float] = mapped_column(Float, nullable=True)
    statCategoryIndexes: Mapped[JSON] = mapped_column(JSON, nullable=True)
    school: Mapped[str] = mapped_column(String, nullable=True)
    pitcherStats: Mapped[JSON] = mapped_column(JSON, nullable=True)

    #relationships
    homeGames: Mapped[list["Games"]] = relationship("Games", foreign_keys="[Games.homeTeam]", back_populates="homeTeamDetails")
    awayGames: Mapped[list["Games"]] = relationship("Games", foreign_keys="[Games.awayTeam]", back_populates="awayTeamDetails")
    outcomes: Mapped[list["Outcomes"]] = relationship("Outcomes", foreign_keys="[Outcomes.teamId]", back_populates="teams", cascade="all, delete-orphan")