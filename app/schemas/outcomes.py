from typing import Any, Optional
from pydantic import BaseModel

class OutcomeRead(BaseModel):
    id: Optional[int] = None
    marketId: Optional[int] = None
    teamId: Optional[int] = None
    name: Optional[str] = None
    price: Optional[float] = None
    impliedProbability: Optional[float] = None
    point: Optional[float] = None

    class Config:
        from_attributes = True