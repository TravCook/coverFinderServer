from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from datetime import datetime, timedelta
from sqlalchemy.sql import Select, Delete, Update, Insert, and_
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.exc import InterfaceError
from sqlalchemy.orm import sessionmaker, selectinload, with_loader_criteria, contains_eager
from typing import Optional
import asyncio
import json
from fastapi.responses import StreamingResponse
from fastapi.middleware.gzip import GZipMiddleware
from app.database.game_model import Games
from app.database.sport_model import Sports
from app.database.bookmaker_model import Bookmakers
from app.database.market_model import Markets
from app.database.team_model import Teams
from app.database.stat_model import Stats
from app.database.mlModelWeights import MlModelWeights
from app.schemas.baseResponeSchema import APIResponse, DeleteResponse
from app.schemas.oddsDeleteRequestSchema import OddsDeleteRequest
from app.helpers.dataHelpers.sport_in_season import sport_in_season
from app.helpers.dataHelpers.get_async_session_factory import get_async_session_factory
import logging
logger = logging.getLogger(__name__)

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

app.add_middleware(GZipMiddleware, minimum_size=500)
# ------------------- Simple in-memory cache -------------------
cache: Optional[dict] = None
cache_timestamp: Optional[datetime] = None
CACHE_TTL_SECONDS = 30  # cache valid for 30 seconds

# ------------------- Helper function -------------------


async def run_query(query_or_fn):
    async with AsyncSessionLocal() as session:
        stmt = query_or_fn() if callable(query_or_fn) else query_or_fn
        result = await session.execute(stmt)
        await session.commit()

        # SELECT → return rows
        if isinstance(stmt, Select):
            return result.scalars().all()

        # DELETE / UPDATE / INSERT → return affected row count
        return result.rowcount


#--------------------LIVE SCORE STREAM ------------------

from copy import deepcopy

# Store last sent data in memory
previous_state = {
    "upcoming": {},
    "past": {},
    "sports": {}
}

async def event_stream():
    global previous_state
    now = datetime.now()
    today = now - timedelta(days=1)

    while True:
        # Queries (same as before)
        upcoming_query_fn = lambda: Select(Games).where(Games.complete == False).options(
            selectinload(Games.homeTeamDetails),
            selectinload(Games.awayTeamDetails),
            selectinload(Games.bookmakers).selectinload(Bookmakers.markets).selectinload(Markets.outcomes)
        )
        past_query_fn = lambda: Select(Games).where(
            and_(Games.complete == True, Games.commence_time >= today)
        ).options(
            selectinload(Games.homeTeamDetails),
            selectinload(Games.awayTeamDetails),
            selectinload(Games.bookmakers).selectinload(Bookmakers.markets).selectinload(Markets.outcomes)
        )
        sports_query_fn = lambda: Select(Sports).options(
            selectinload(Sports.hyperParameters),
            selectinload(Sports.valueBetSettings),
        )

        try:
            upcoming_games, past_games, sports = await asyncio.gather(
                run_query(upcoming_query_fn),
                run_query(past_query_fn),
                run_query(sports_query_fn)
            )
        except InterfaceError:
            await asyncio.sleep(2)
            continue

        # Convert lists to dicts keyed by ID for easy diffing
        upcoming_dict = {g.id: jsonable_encoder(g) for g in upcoming_games}
        past_dict = {g.id: jsonable_encoder(g) for g in past_games}
        sports_dict = {s.id: jsonable_encoder(s) for s in sports}

        # Compute deltas (only new or changed entries)
        def get_deltas(new, old):
            return {k: v for k, v in new.items() if old.get(k) != v}

        delta_upcoming = get_deltas(upcoming_dict, previous_state["upcoming"])
        delta_past = get_deltas(past_dict, previous_state["past"])

        yield f"data: {json.dumps({'odds': delta_upcoming, 'pastGames': delta_past, 'sports': sports_dict})}\n\n"

        # Update previous_state
        previous_state["upcoming"] = deepcopy(upcoming_dict)
        previous_state["past"] = deepcopy(past_dict)

        await asyncio.sleep(2)


@app.get("/liveUpdates")
async def sse_endpoint():
    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.post("/api/odds/delete", response_model=DeleteResponse)
async def delete_game(request: OddsDeleteRequest):
    game_id = request.game_id
    logger.info(game_id)

    delete_stat_fn = lambda: Delete(Stats).where(Stats.gameId == game_id)
    delete_game_fn = lambda: Delete(Games).where(Games.id == game_id)

    await run_query(delete_stat_fn)
    logger.info("DELETED STATS")

    await run_query(delete_game_fn)
    logger.info("DELETED GAMES")

    return {"message": "POST received", "game_id": game_id}


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
    upcoming_query_fn = lambda: Select(Games).where(Games.complete == False).options(
        selectinload(Games.homeTeamDetails),
        selectinload(Games.awayTeamDetails),
        selectinload(Games.bookmakers).selectinload(Bookmakers.markets).selectinload(Markets.outcomes)
    )

    past_query_fn = lambda: (
        Select(Games)
        .join(Games.bookmakers)
        .where(
            and_(
                Games.complete == True,
                Games.commence_time >= thirty_days_ago,
                Bookmakers.key == 'fanduel'
            )
        )
        .options(
            contains_eager(Games.bookmakers)
                .selectinload(Bookmakers.markets)
                .selectinload(Markets.outcomes),
            selectinload(Games.homeTeamDetails),
            selectinload(Games.awayTeamDetails),
        )
    )

    sports_query_fn = lambda: Select(Sports).options(
        selectinload(Sports.hyperParameters),
        selectinload(Sports.valueBetSettings),
    )

    teams_query_fn = lambda: Select(Teams)
    weights_query_fn = lambda: Select(MlModelWeights)

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
