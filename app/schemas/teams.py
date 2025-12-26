from typing import Optional, Any
from pydantic import BaseModel

class TeamRead(BaseModel):
    id: Optional[int] = None
    teamName: Optional[str] = None
    lightLogo: Optional[str] = None
    darkLogo: Optional[str] = None
    league: Optional[str] = None
    espnID: Optional[int] = None
    abbreviation: Optional[str] = None
    espnDisplayName: Optional[str] = None
    mainColor: Optional[str] = None
    secondaryColor: Optional[str] = None
    currentStats: Optional[Any] = None
    espnLeague: Optional[str] = None
    statIndex: Optional[float] = None
    scaledStatIndex: Optional[float] = None
    statCategoryIndexes: Optional[Any] = None
    school: Optional[str] = None
    pitcherStats: Optional[Any] = None

    class Config:
        from_attributes = True