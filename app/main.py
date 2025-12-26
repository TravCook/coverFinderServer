from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from datetime import datetime, timedelta
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.exc import InterfaceError
from sqlalchemy.orm import sessionmaker, selectinload
from typing import Optional
import asyncio
import json
from fastapi.responses import StreamingResponse
from app.database.game_model import Games
from app.database.sport_model import Sports
from app.database.bookmaker_model import Bookmakers
from app.database.market_model import Markets
from app.database.team_model import Teams
from app.database.mlModelWeights import MlModelWeights
from app.schemas.baseResponeSchema import APIResponse
from app.helpers.dataHelpers.sport_in_season import sport_in_season
from app.helpers.dataHelpers.get_async_session_factory import get_async_session_factory

# ------------------- Setup -------------------
AsyncSessionLocal, engine = get_async_session_factory()

app = FastAPI()

# ------------------- CORS -------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # front-end URL
    allow_methods=["*"],  # allow GET, POST, OPTIONS, etc.
    allow_headers=["*"],
)


# ------------------- Simple in-memory cache -------------------
cache: Optional[dict] = None
cache_timestamp: Optional[datetime] = None
CACHE_TTL_SECONDS = 30  # cache valid for 30 seconds

# ------------------- Helper function -------------------
async def run_query(query_fn, retries=2):
    for attempt in range(retries + 1):
        try:
            async with AsyncSessionLocal() as session:
                result = await session.execute(query_fn())
                return result.scalars().all()
        except InterfaceError as e:
            if attempt < retries:
                await asyncio.sleep(1)  # wait a bit and retry
            else:
                raise

#--------------------LIVE SCORE STREAM ------------------

async def event_stream():
    now = datetime.now()
    today = now - timedelta(days=1)
    while True:
        upcoming_query_fn = lambda: select(Games).where(Games.complete == False).options(
            selectinload(Games.homeTeamDetails),
            selectinload(Games.awayTeamDetails),
            selectinload(Games.bookmakers).selectinload(Bookmakers.markets).selectinload(Markets.outcomes)
        )
        past_query_fn = lambda: select(Games).where(
            and_(Games.complete == True, Games.commence_time >= today)
        ).options(
            selectinload(Games.homeTeamDetails),
            selectinload(Games.awayTeamDetails),
            selectinload(Games.bookmakers).selectinload(Bookmakers.markets).selectinload(Markets.outcomes)
        )

        try:
            upcoming_games, past_games = await asyncio.gather(
                run_query(upcoming_query_fn),
                run_query(past_query_fn),
            )
        except InterfaceError:
            # skip this iteration if connection failed
            await asyncio.sleep(2)
            continue

        data = {
            "odds": jsonable_encoder(upcoming_games),
            "pastGames": jsonable_encoder(past_games),
        }
        yield f"data: {json.dumps(data)} \n\n"
        await asyncio.sleep(2)

@app.get("/liveUpdates")
async def sse_endpoint():
    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ------------------- Routes -------------------
@app.get("/api/odds", response_model=APIResponse)
async def read_root():
    global cache, cache_timestamp
    now = datetime.now()
    thirty_days_ago = now - timedelta(days=180)

    # Return cache if still valid
    # if cache and cache_timestamp and (now - cache_timestamp).total_seconds() < CACHE_TTL_SECONDS:
    #     return cache

    # ------------------- Prepare query lambdas -------------------
    upcoming_query_fn = lambda: select(Games).where(Games.complete == False).options(
        selectinload(Games.homeTeamDetails),
        selectinload(Games.awayTeamDetails),
        selectinload(Games.bookmakers).selectinload(Bookmakers.markets).selectinload(Markets.outcomes)
    )

    past_query_fn = lambda: select(Games).where(
        and_(Games.complete == True, Games.commence_time >= thirty_days_ago)
    ).options(
        selectinload(Games.homeTeamDetails),
        selectinload(Games.awayTeamDetails),
        selectinload(Games.bookmakers).selectinload(Bookmakers.markets).selectinload(Markets.outcomes)
    )

    sports_query_fn = lambda: select(Sports).options(
        selectinload(Sports.hyperParameters),
        selectinload(Sports.valueBetSettings),
    )

    teams_query_fn = lambda: select(Teams)
    weights_query_fn = lambda: select(MlModelWeights)

    # ------------------- Run queries concurrently -------------------
    upcoming_games, past_games, sports, teams, weights = await asyncio.gather(
        run_query(upcoming_query_fn),
        run_query(past_query_fn),
        run_query(sports_query_fn),
        run_query(teams_query_fn),
        run_query(weights_query_fn)
    )


    response = {
        "odds": upcoming_games,
        "pastGames": past_games,
        "sports": sports,
        "teams": teams,
        "mlModelWeights": weights
    }

    # ------------------- Update cache -------------------
    cache = response
    cache_timestamp = now

    return response

# ------------------- Run -------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=3001)
