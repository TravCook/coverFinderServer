from typing import Any, Optional
from pydantic import BaseModel

class MlModelWeights(BaseModel):
    id: int
    featureImportanceScoresTeam: Optional[Any] = None
    featureImportanceScoresFull: Optional[Any] = None
    sport: int

    class Config:
        from_attributes = True