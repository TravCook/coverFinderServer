from app.celery_app.celery import celery
from app.helpers.dataHelpers.db_getters.get_sports_sync import get_sports_sync
from app.helpers.dataHelpers.sport_in_season import sport_in_season
import logging
import asyncio
import aiohttp
from datetime import datetime
from app.helpers.dataHelpers.outbound_api_request import fetch_data
from app.helpers.dataHelpers.get_async_session_factory import get_async_session_factory
from dotenv import load_dotenv
import os
import json
from asyncio import Lock
from pathlib import Path

logger = logging.getLogger(__name__)
load_dotenv()

# Define the order of keys to use
API_KEYS = [
    os.getenv("ODDS_KEY_TRAVM"),   # Default / primary key
    os.getenv("ODDS_KEY_TCDEV"),
    os.getenv("ODDS_KEY_SMOKEY"),
    os.getenv("ODDS_KEY_LOWRES"),
    os.getenv("ODDS_KEY_TRAVISMC")
]

# Where to persist the active key index
CACHE_FILE = Path("odds_api_key_state.json")

# Global state
_current_key_index = 0
_last_reset_month = datetime.now().month
_key_lock = Lock()


# --------------------------
# Persistent Key Management
# --------------------------
def _load_key_state():
    """Load the persisted key state from disk (if any)."""
    global _current_key_index, _last_reset_month
    if CACHE_FILE.exists():
        try:
            data = json.loads(CACHE_FILE.read_text())
            _current_key_index = int(data.get("index", 0))
            _last_reset_month = int(data.get("month", datetime.now().month))
            logger.info(f"📦 Loaded persisted API key index: {_current_key_index}, month: {_last_reset_month}")
        except Exception as e:
            logger.warning(f"⚠️ Failed to load key state: {e}. Resetting to default.")
            _current_key_index = 0
            _last_reset_month = datetime.now().month
    else:
        _save_key_state()


def _save_key_state():
    """Save the current key index and month to disk."""
    try:
        data = {"index": _current_key_index, "month": _last_reset_month}
        CACHE_FILE.write_text(json.dumps(data))
    except Exception as e:
        logger.error(f"❌ Failed to save key state: {e}")


async def get_current_api_key() -> str:
    """Return the current active API key (thread-safe, resetting monthly)."""
    global _last_reset_month, _current_key_index

    # async with _key_lock:
    current_month = datetime.now().month
    if current_month != _last_reset_month:
        logger.info("🗓️ New month detected — resetting API key rotation to default (index 0).")
        _current_key_index = 0
        _last_reset_month = current_month
        _save_key_state()

    return API_KEYS[_current_key_index]


async def rotate_api_key():
    """Rotate to the next available key in the list (thread-safe, persistent)."""
    global _current_key_index
    # async with _key_lock:
    _current_key_index = (_current_key_index + 1) % len(API_KEYS)
    _save_key_state()
    new_key = API_KEYS[_current_key_index]
    # logger.warning(f"🔁 Rotated to new API key index {_current_key_index}: {new_key}")
    return new_key


async def fetch_with_backoff(url, session, retries=3):
    delay = 1

    for attempt in range(retries):
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=20)) as resp:
                text = await resp.text()
                
                # Try to decode JSON body
                try:
                    data = json.loads(text)
                except:
                    data = text

                # Return BOTH json + headers
                return data, resp.headers

        except Exception as e:
            if attempt == retries - 1:
                raise
            await asyncio.sleep(delay)
            delay *= 2



async def fetch_odds_for_sport(sport_name: str, session):
    base_url = "https://api.the-odds-api.com/v4/sports"

    for _ in range(len(API_KEYS)):
        async with _key_lock:
            api_key = await get_current_api_key()

        url = f"{base_url}/{sport_name}/odds/?apiKey={api_key}&regions=us&oddsFormat=american&markets=h2h,spreads,totals"

        try:
            response, headers = await fetch_with_backoff(url, session)

            credits_remaining = int(headers.get("X-Requests-Remaining", 0))
            logger.info(f"Key {api_key} has {credits_remaining} requests remaining.")

            if credits_remaining <= 3:
                async with _key_lock:
                    await rotate_api_key()
                continue

            return response

        except Exception as e:
            logger.error(f"Error fetching odds for {sport_name}: {e}")
            continue

    logger.error("All API keys exhausted.")
    return None

async def fetch_odds_api_with_backoff(sports: list[dict]):
    """Fetch odds for all sports concurrently, sharing persistent key state."""
    _load_key_state()

    async with aiohttp.ClientSession() as session:
        tasks = [fetch_odds_for_sport(sport.name, session) for sport in sports]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, Exception):
                logger.exception("Task failed", exc_info=r)


    valid_results = [
        item
        for r in results
        if not isinstance(r, Exception)
        for item in (r if isinstance(r, list) else [r])
    ]

    return valid_results
