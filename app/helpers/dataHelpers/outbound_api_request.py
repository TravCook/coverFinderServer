# app/helpers/dataHelpers/outbound_api_request.py
import aiohttp
import asyncio
import logging

logger = logging.getLogger(__name__)
_CACHE = {}

async def fetch_data(url: str, session: aiohttp.ClientSession = None, use_cache: bool = False):
    if use_cache and url in _CACHE:
        return _CACHE[url]

    close_session = False
    if session is None:
        session = aiohttp.ClientSession()
        close_session = True

    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=20)) as resp:
            resp.raise_for_status()
            data = await resp.json()
            if use_cache:
                _CACHE[url] = data
            return data
    finally:
        if close_session:
            await session.close()
