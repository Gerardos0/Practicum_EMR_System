from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

connect_args: dict = {"ssl": True} if settings.database_ssl else {}

engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)

# expire_on_commit=False matters in async: otherwise touching an attribute after
# commit triggers a lazy load, which raises MissingGreenlet.
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
