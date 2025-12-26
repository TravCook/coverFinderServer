from sqlalchemy import String, Integer, DateTime, Boolean, Float, JSON, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class Stats(Base):
    __tablename__ = "Stats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    gameId: Mapped[int] = mapped_column(ForeignKey("Games.id"))
    teamId: Mapped[int] = mapped_column(ForeignKey("Teams.id"))
    sport: Mapped[int] = mapped_column(ForeignKey("Sports.id"))
    data: Mapped[JSON] = mapped_column(JSON, nullable=False)

    #relationships
    # team: Mapped["Teams"] = relationship("Teams", foreign_keys=[teamId], back_populates="stats")
    game: Mapped["Games"] = relationship("Games", foreign_keys=[gameId, teamId], back_populates="homeStats")

    __table_args__ = (
        Index('ix_game_team_unique', 'gameId', 'teamId', unique=True),
    )