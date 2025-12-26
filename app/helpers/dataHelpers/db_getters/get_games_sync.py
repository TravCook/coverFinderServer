from sqlalchemy import select, exists
from sqlalchemy.orm import selectinload
from app.database.game_model import Games
from app.database.bookmaker_model import Bookmakers
from app.database.market_model import Markets

async def get_games_sync(sport, AsyncSessionLocal):
    """Run async query from sync context."""
    async with AsyncSessionLocal() as session:
        stmt = select(Games).where(Games.sport_key == sport.name).options(
            selectinload(Games.homeTeamDetails),
            selectinload(Games.awayTeamDetails),
            selectinload(Games.homeStats),
            selectinload(Games.awayStats),
            selectinload(Games.bookmakers)
                .selectinload(Bookmakers.markets)
                .selectinload(Markets.outcomes)
        )
        result = await session.execute(stmt)
        return result.scalars().all()
    
async def get_games_with_bookmakers_sync(sport, AsyncSessionLocal):
    async with AsyncSessionLocal() as session:
        stmt = (
            select(Games)
            .where(Games.sport_key == sport.name)
            .where(
                exists().where(Bookmakers.gameId == Games.id)
            )
            .options(
                selectinload(Games.homeTeamDetails),
                selectinload(Games.awayTeamDetails),
                selectinload(Games.homeStats),
                selectinload(Games.awayStats),
                selectinload(Games.bookmakers)
                    .selectinload(Bookmakers.markets)
                    .selectinload(Markets.outcomes)
            )
        )

        result = await session.execute(stmt)
        return result.scalars().all()


async def get_upcoming_games_sync(sport, AsyncSessionLocal):
    async with AsyncSessionLocal() as session:
        stmt = select(Games).where((Games.sport_key == sport.name) & (Games.complete == False)).options(
        selectinload(Games.homeTeamDetails),
        selectinload(Games.awayTeamDetails),
        selectinload(Games.homeStats),
        selectinload(Games.awayStats)
        )
        result = await session.execute(stmt)
        return result.scalars().all()