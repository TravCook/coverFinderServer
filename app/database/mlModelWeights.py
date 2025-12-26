from sqlalchemy import String, Integer, DateTime, Boolean, Float, JSON, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class MlModelWeights(Base):
    __tablename__ = "MlModelWeights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    featureImportanceScoresTeam: Mapped[JSON] = mapped_column(JSON, nullable=True)
    featureImportanceScoresFull: Mapped[JSON] = mapped_column(JSON, nullable=True)
    hiddenToOutputWeights: Mapped[JSON] = mapped_column(JSON, nullable=False)
    inputToHiddenWeights: Mapped[JSON] = mapped_column(JSON, nullable=False)
    sport: Mapped[int] = mapped_column(ForeignKey("Sports.id"), unique=True)

    #relationships
    # sport: Mapped["Sports"] = relationship("Sports", foreign_keys=[sport], back_populates="mlModelWeights")


    # __table_args__ = (
    #     Index('ix_sport', 'sport', unique=True),
    # )   