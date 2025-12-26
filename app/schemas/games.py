from typing import Any, Optional, List
import math
from pydantic import BaseModel
from datetime import datetime
from .teams import TeamRead
from .bookmakers import BookmakerRead

class GameRead(BaseModel):
    id: int
    oddsApiID: str
    homeTeam: int
    awayTeam: int
    sport_title: Optional[str] = None
    sport_key: Optional[str] = None
    commence_time: Optional[datetime] = None
    homeTeamIndex: Optional[float] = None
    awayTeamIndex: Optional[float] = None
    homeTeamScaledIndex: Optional[float] = None
    awayTeamScaledIndex: Optional[float] = None
    winPercent: Optional[float] = None
    predictedWinner: Optional[str] = None
    predictionConfidence: Optional[float] = None
    homeScore: Optional[int] = None
    awayScore: Optional[int] = None
    timeRemaining: Optional[str] = None
    sport: Optional[int] = None
    predictionCorrect: Optional[bool] = None
    winner: Optional[str] = None
    complete: Optional[bool] = None
    predictedHomeScore: Optional[int] = None
    predictedAwayScore: Optional[int] = None
    probablePitcher: Optional[Any] = None
    homeTeamDetails: TeamRead
    awayTeamDetails: TeamRead
    bookmakers: List[BookmakerRead] = []
    value_score: Optional[float] = None

    class Config:
        from_attributes = True
        json_encoders = {
            float: lambda v: None if math.isnan(v) else v
        }