from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os
load_dotenv()

# DATABASE_URL = (
#     f"postgresql+asyncpg://"
#     f"{os.getenv('POSTGRES_USER_LOCAL')}:"
#     f"{os.getenv('POSTGRES_PASS_LOCAL')}@"
#     f"{os.getenv('POSTGRES_DB_HOST_LOCAL')}/"
#     f"{os.getenv('POSTGRES_DB_NAME')}"
# )
DATABASE_URL = (
    f"postgresql+asyncpg://"
    f"{os.getenv('POSTGRES_USER_LOCAL')}:"
    f"{os.getenv('POSTGRES_PASS_LOCAL')}@"
    f"{os.getenv('POSTGRES_DB_HOST_DOCKER')}/"
    f"{os.getenv('POSTGRES_DB_NAME')}"
)

def get_async_session_factory():
    engine = create_async_engine(DATABASE_URL, echo=False, future=True)
    return sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False), engine
