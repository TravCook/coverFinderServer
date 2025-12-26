from sqlalchemy import String, Integer, DateTime, Boolean, Float, JSON, Index, ForeignKey, and_
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base

from .team_model import Teams
from .sport_model import Sports
from .stat_model import Stats

class Games(Base):
    __tablename__ = "Games"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    oddsApiID: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    homeTeam: Mapped[int] = mapped_column(ForeignKey("Teams.id"), nullable=False)
    awayTeam: Mapped[int] = mapped_column(ForeignKey("Teams.id"), nullable=False)
    sport_title: Mapped[str] = mapped_column(String, nullable=False)
    sport_key: Mapped[str] = mapped_column(String, nullable=False)
    commence_time: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    homeTeamIndex: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    awayTeamIndex: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    homeTeamScaledIndex: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    awayTeamScaledIndex: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    winPercent: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    predictedWinner: Mapped[str] = mapped_column(String, nullable=False, default="")
    predictionConfidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    homeScore: Mapped[int] = mapped_column(Integer, nullable=True)
    awayScore: Mapped[int] = mapped_column(Integer, nullable=True)
    timeRemaining: Mapped[str] = mapped_column(String, nullable=True)
    sport: Mapped[int] = mapped_column(ForeignKey("Sports.id"), nullable=False)
    predictionCorrect: Mapped[Boolean] = mapped_column(Boolean, nullable=True)
    winner: Mapped[str] = mapped_column(String, nullable=True)
    complete: Mapped[Boolean] = mapped_column(Boolean, nullable=False, default=False)
    predictedHomeScore: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    predictedAwayScore: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    probablePitcher: Mapped[JSON] = mapped_column(JSON, nullable=True)
    value_score: Mapped[float] = mapped_column(Float, nullable=True)
    #relationships
    homeTeamDetails: Mapped["Teams"] = relationship("Teams", foreign_keys=[homeTeam], back_populates="homeGames")
    awayTeamDetails: Mapped["Teams"] = relationship("Teams", foreign_keys=[awayTeam], back_populates="awayGames")
    bookmakers: Mapped[list["Bookmakers"]] = relationship("Bookmakers", foreign_keys="[Bookmakers.gameId]", back_populates="game", cascade="all, delete-orphan")
    sportDetails: Mapped["Sports"] = relationship("Sports", foreign_keys=[sport], back_populates="games")
    homeStats: Mapped["Stats"] = relationship(
        "Stats",
        primaryjoin=and_(
            Stats.gameId == id,       # Stats.gameId matches this Game's id
            Stats.teamId == homeTeam  # Stats.teamId matches this Game's homeTeam
        ),
        viewonly=True,
        cascade="all, delete-orphan"
    )

    awayStats: Mapped["Stats"] = relationship(
        "Stats",
        primaryjoin=and_(
            Stats.gameId == id,
            Stats.teamId == awayTeam
        ),
        viewonly=True,
        cascade="all, delete-orphan"
    )


    __table_args__ = (
        Index('uq_game_unique', 'homeTeam', 'awayTeam', 'commence_time', 'sport', unique=True),
        Index('ix_sport_complete', 'sport_key', 'complete'),
    )