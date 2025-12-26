from typing import Any, Optional
from pydantic import BaseModel

class HyperParamRead(BaseModel):
    id: int
    sport: int
    scoreMAE: Optional[float] = None
    spreadMAE: Optional[float] = None
    totalMAE: Optional[float] = None

    class Config:
        from_attributes = True