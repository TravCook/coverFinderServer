from typing import Any, Optional, List
from pydantic import BaseModel
from .markets import MarketRead

class BookmakerRead(BaseModel):
    id: Optional[int] = None
    gameId: Optional[int] = None
    title: Optional[str] = None
    key: Optional[str] = None
    markets: List[MarketRead] = []

    class Config:
        from_attributes = True