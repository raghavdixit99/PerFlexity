"""Database service for conversation and message operations."""

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from core.database import Conversation, Message
from models.domain import ConversationContext

logger = logging.getLogger(__name__)


async def create_conversation(db: AsyncSession, title: str) -> str:
    """Create a new conversation and return its ID."""
    try:
        conversation = Conversation(
            id=str(uuid.uuid4()),
            title=_generate_conversation_title(title),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
        
        logger.info(f"Created new conversation: {conversation.id}")
        return conversation.id
        
    except Exception as e:
        logger.error(f"Failed to create conversation: {e}")
        await db.rollback()
        raise


async def get_conversation(db: AsyncSession, conversation_id: str) -> Optional[Conversation]:
    """Get conversation by ID."""
    try:
        result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        return result.scalar_one_or_none()
        
    except Exception as e:
        logger.error(f"Failed to get conversation {conversation_id}: {e}")
        return None


async def get_conversations(db: AsyncSession, limit: int = 50) -> List[Conversation]:
    """Get list of conversations ordered by last update."""
    try:
        result = await db.execute(
            select(Conversation)
            .order_by(desc(Conversation.updated_at))
            .limit(limit)
        )
        return result.scalars().all()
        
    except Exception as e:
        logger.error(f"Failed to get conversations: {e}")
        return []


async def save_message(
    db: AsyncSession, 
    conversation_id: str, 
    role: str, 
    content: str,
) -> str:
    """Save a message to the conversation in a single atomic transaction."""
    try:
        # Create message
        message = Message(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            role=role,
            content=content,
            created_at=datetime.now(timezone.utc)
        )
        db.add(message)
        
        # Update conversation timestamp in same atomic transaction
        conversation = await db.get(Conversation, conversation_id)
        if conversation:
            conversation.updated_at = datetime.now(timezone.utc)
        
        # Single commit for both operations
        await db.commit()
        
        logger.debug(f"Saved message {message.id} to conversation {conversation_id}")
        return message.id
        
    except Exception as e:
        logger.error(f"Failed to save message: {e}")
        await db.rollback()
        raise


async def delete_conversation(db: AsyncSession, conversation_id: str) -> bool:
    """Delete a conversation and all its messages."""
    try:
        # Delete messages first
        await db.execute(
            select(Message).where(Message.conversation_id == conversation_id)
        )
        
        # Delete conversation
        conversation = await db.get(Conversation, conversation_id)
        if conversation:
            await db.delete(conversation)
            await db.commit()
            logger.info(f"Deleted conversation: {conversation_id}")
            return True
        
        return False
        
    except Exception as e:
        logger.error(f"Failed to delete conversation {conversation_id}: {e}")
        await db.rollback()
        return False


async def get_conversation_context(db: AsyncSession, conversation_id: str) -> Optional[ConversationContext]:
    """Get conversation context for LLM processing."""
    try:
        if not conversation_id:
            return None
            
        messages_query = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(desc(Message.created_at))
            .limit(6)
        )
        
        result = await db.execute(messages_query)
        messages = result.scalars().all()
        
        if not messages:
            return None
        
        context_messages = []
        for msg in reversed(messages):
            context_messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        return ConversationContext(
            conversation_id=conversation_id,
            messages=context_messages,
            user_message_id=""
        )
        
    except Exception as e:
        logger.error(f"Failed to get conversation context for {conversation_id}: {e}")
        return None


def _generate_conversation_title(message: str) -> str:
    """Generate a conversation title from the first message."""
    # Clean and truncate message for title
    title = message.strip()
    
    # Remove newlines and extra spaces
    title = ' '.join(title.split())
    
    # Truncate to reasonable length
    if len(title) > 50:
        title = title[:47] + "..."
    
    return title or "New Conversation"