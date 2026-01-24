from sqlalchemy import String, Integer, DateTime, Boolean, Float, JSON, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base



class Bookmakers(Base):
    __tablename__ = "Bookmakers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    gameId: Mapped[int] = mapped_column(
        ForeignKey("Games.id", ondelete="CASCADE"),
        nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    key: Mapped[str] = mapped_column(String, nullable=False)

    # relationships
    game: Mapped["Games"] = relationship(
        "Games",
        back_populates="bookmakers"
    )

    markets: Mapped[list["Markets"]] = relationship(
        "Markets",
        back_populates="bookmaker",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_bookmaker_game", "gameId", "key", unique=True),
    )
