from typing import Any, Optional, List
from pydantic import BaseModel
from .outcomes import OutcomeRead

class MarketRead(BaseModel):
    id: Optional[int] = None
    bookmakerId: Optional[int] = None
    key: Optional[str] = None
    outcomes: List[OutcomeRead] = []

    class Config:
        from_attributes = True