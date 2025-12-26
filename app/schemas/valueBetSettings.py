from typing import Any, Optional
from pydantic import BaseModel

class ValueBetRead(BaseModel):
    id: int
    sport: int
    segmentVariance: Optional[float] = None
    segmentReliability: Optional[float] = None
    segmentThreshold: Optional[float] = None
    sampleSize: Optional[float] = None
    segmentKey: Optional[str] = None
    segmentJsCondition: Optional[str] = None

    class Config:
        from_attributes = True