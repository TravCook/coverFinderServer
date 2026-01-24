from pydantic import BaseModel

class OddsDeleteRequest(BaseModel):
    game_id: int
