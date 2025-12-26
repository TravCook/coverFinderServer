from pydantic import BaseModel
from typing import List
from .games import GameRead
from .sports import SportRead
from .teams import TeamRead
from .weights import MlModelWeights

class APIResponse(BaseModel):
    odds: List[GameRead]
    pastGames: List[GameRead]
    sports: List[SportRead]
    teams: List[TeamRead]
    mlModelWeights: List[MlModelWeights]