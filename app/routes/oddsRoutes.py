from fastapi import APIRouter

odds_router = APIRouter()

@odds_router.get("/odds")
async def get_odds():
    return {"odds": "Sample odds data"}

