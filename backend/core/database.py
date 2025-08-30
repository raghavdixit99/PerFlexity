"""Database configuration and models."""

import logging
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Integer, Text, Boolean, ForeignKey, Index
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, selectinload
from contextlib import asynccontextmanager
from typing import List, Optional
from .config import get_settings

logger = logging.getLogger(__name__)

# SQLAlchemy setup
Base = declarative_base()

# Global engine and session
engine = None
async_session_factory = None


class Conversation(Base):
    """Conversation ORM model."""
    __tablename__ = "conversations"
    
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('ix_conversations_updated_at', 'updated_at'),
        Index('ix_conversations_title', 'title'),  # For search functionality
    )


class Message(Base):
    """Message ORM model."""
    __tablename__ = "messages"
    
    id = Column(String, primary_key=True)
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    
    # Indexes
    __table_args__ = (
        Index('ix_messages_conversation_id', 'conversation_id'),
        Index('ix_messages_created_at', 'created_at'),
        Index('ix_messages_content', 'content'),  # For search functionality
    )


# In-memory document cache for vector retrieval
class DocumentCache:
    """Simple in-memory document cache with vector storage."""
    
    def __init__(self, max_size: int = 1000):
        self.max_size = max_size
        self.cache = {}  # url -> {content, title, vector, timestamp}
        self.access_order = []  # For LRU eviction
    
    def get(self, url: str) -> Optional[dict]:
        """Get document from cache."""
        if url in self.cache:
            # Update access order
            if url in self.access_order:
                self.access_order.remove(url)
            self.access_order.append(url)
            return self.cache[url]
        return None
    
    def put(self, url: str, content: str, title: str, vector: List[float]):
        """Store document in cache."""
        # Evict oldest if at capacity
        if len(self.cache) >= self.max_size and url not in self.cache:
            oldest_url = self.access_order.pop(0)
            del self.cache[oldest_url]
        
        # Store document
        self.cache[url] = {
            "content": content,
            "title": title,
            "vector": vector,
            "timestamp": datetime.now(timezone.utc)
        }
        
        # Update access order
        if url in self.access_order:
            self.access_order.remove(url)
        self.access_order.append(url)
    
    def clear(self):
        """Clear all cached documents."""
        self.cache.clear()
        self.access_order.clear()
    
    def size(self) -> int:
        """Get current cache size."""
        return len(self.cache)


# Global document cache
document_cache = DocumentCache()


async def init_database():
    """Initialize database connection and create tables."""
    global engine, async_session_factory
    
    settings = get_settings()
    logger.info(f"Initializing database: {settings.database_url}")
    
    # Create async engine
    engine = create_async_engine(
        settings.database_url,
        echo=settings.debug,
        pool_pre_ping=True
    )
    
    # Create session factory
    async_session_factory = async_sessionmaker(
        engine, 
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    logger.info("Database initialized successfully")


async def close_database():
    """Close database connection."""
    global engine
    if engine:
        await engine.dispose()
        logger.info("Database connection closed")


@asynccontextmanager
async def get_db_session():
    """Get database session context manager."""
    if async_session_factory is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def health_check() -> bool:
    """Check database health."""
    try:
        async with get_db_session() as session:
            # Simple query to test connection
            from sqlalchemy import text; await session.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False