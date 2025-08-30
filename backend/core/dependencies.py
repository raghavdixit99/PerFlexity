"""FastAPI dependencies."""

import logging
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from .database import get_db_session


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)


async def get_db() -> AsyncSession:
    """Dependency for database session."""
    async with get_db_session() as session:
        yield session


def get_logger():
    """Dependency for logger."""
    return logger