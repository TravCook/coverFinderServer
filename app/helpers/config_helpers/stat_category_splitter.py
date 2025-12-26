import logging
from app.helpers.dataHelpers.db_getters.get_sports_sync import get_sports_sync
from app.helpers.dataHelpers.get_async_session_factory import get_async_session_factory
from app.helpers.config_helpers.espn_stat_config_map import new_statMap
from collections import defaultdict
logger = logging.getLogger(__name__)


async def stat_category_splitter():
    """Train regression + classification models using grouped rolling TSCV,
    prevent leakage, and evaluate on a final 10% holdout set."""

    AsyncSessionLocal, engine = get_async_session_factory()
    all_sports = await get_sports_sync(AsyncSessionLocal)
    for sport in all_sports:

        # ---- SPLIT INTO LISTS BY CATEGORY ----
        category_lists = defaultdict(list)

        for stat_name, data in new_statMap[sport.name].items():
            # logger.info(stat_name, data)
            category = data["category"]
            category_lists[category].append(stat_name)

        # Convert defaultdict to normal dict if desired
        category_lists = dict(category_lists)

        print(category_lists)