"""Conversations management endpoints."""

import uuid
import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, delete, or_, and_

from core.dependencies import get_db, get_logger
from core.database import Conversation, Message
from core.exceptions import not_found_exception, internal_server_exception
from models.api import ConversationsResponse, ConversationSummary

router = APIRouter(prefix="/conversations", tags=["Conversations"])


@router.get(
    "",
    response_model=ConversationsResponse,
    summary="List conversations",
    description="Get a paginated list of conversations."
)
async def list_conversations(
    limit: int = 20,
    page: int = 1,
    db: AsyncSession = Depends(get_db),
    logger: logging.Logger = Depends(get_logger)
):
    """List conversations with pagination."""
    try:
        # Get conversations with message count
        conversations_query = (
            select(
                Conversation.id,
                Conversation.title,
                Conversation.created_at,
                Conversation.updated_at,
                func.count(Message.id).label("message_count")
            )
            .outerjoin(Message, Conversation.id == Message.conversation_id)
            .group_by(
                Conversation.id,
                Conversation.title, 
                Conversation.created_at,
                Conversation.updated_at
            )
            .order_by(desc(Conversation.updated_at))
            .offset((page - 1) * limit)
            .limit(limit)
        )
        
        result = await db.execute(conversations_query)
        conversations_data = result.all()
        
        # Get total count
        total_query = select(func.count(Conversation.id))
        total_result = await db.execute(total_query)
        total_count = total_result.scalar_one()
        
        # Build response
        conversations = [
            ConversationSummary(
                id=conv.id,
                title=conv.title,
                created_at=conv.created_at,
                updated_at=conv.updated_at,
                message_count=conv.message_count or 0
            )
            for conv in conversations_data
        ]
        
        return ConversationsResponse(
            conversations=conversations,
            total_count=total_count,
            page=page,
            limit=limit
        )
        
    except Exception as e:
        logger.error(f"Failed to list conversations: {e}")
        raise internal_server_exception("Failed to retrieve conversations")


@router.get(
    "/search",
    response_model=ConversationsResponse,
    summary="Search conversations",
    description="Search conversations by title and message content."
)
async def search_conversations(
    q: str,
    limit: int = 20,
    page: int = 1,
    db: AsyncSession = Depends(get_db),
    logger: logging.Logger = Depends(get_logger)
):
    """Search conversations by query string."""
    try:
        if not q or not q.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Search query cannot be empty"
            )
        
        search_term = f"%{q.strip()}%"
        
        # Search conversations by title and message content
        search_query = (
            select(
                Conversation.id,
                Conversation.title,
                Conversation.created_at,
                Conversation.updated_at,
                func.count(Message.id).label("message_count")
            )
            .outerjoin(Message, Conversation.id == Message.conversation_id)
            .where(
                or_(
                    Conversation.title.ilike(search_term),
                    Message.content.ilike(search_term)
                )
            )
            .group_by(
                Conversation.id,
                Conversation.title,
                Conversation.created_at,
                Conversation.updated_at
            )
            .order_by(desc(Conversation.updated_at))
            .offset((page - 1) * limit)
            .limit(limit)
        )
        
        result = await db.execute(search_query)
        conversations_data = result.all()
        
        # Get total count for search results
        count_query = (
            select(func.count(func.distinct(Conversation.id)))
            .select_from(Conversation)
            .outerjoin(Message, Conversation.id == Message.conversation_id)
            .where(
                or_(
                    Conversation.title.ilike(search_term),
                    Message.content.ilike(search_term)
                )
            )
        )
        
        count_result = await db.execute(count_query)
        total_count = count_result.scalar_one()
        
        # Build response
        conversations = [
            ConversationSummary(
                id=conv.id,
                title=conv.title,
                created_at=conv.created_at,
                updated_at=conv.updated_at,
                message_count=conv.message_count or 0
            )
            for conv in conversations_data
        ]
        
        logger.info(f"Search query '{q}' returned {len(conversations)} results")
        
        return ConversationsResponse(
            conversations=conversations,
            total_count=total_count,
            page=page,
            limit=limit
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to search conversations: {e}")
        raise internal_server_exception("Failed to search conversations")


@router.get(
    "/{conversation_id}",
    summary="Get conversation details",
    description="Get detailed information about a specific conversation including messages."
)
async def get_conversation(
    conversation_id: str,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    logger: logging.Logger = Depends(get_logger)
):
    """Get conversation with messages (paginated for performance)."""
    try:
        logger.info(f"Fetching conversation {conversation_id} with limit={limit}, offset={offset}")
        
        # Single query to get conversation and message count
        from sqlalchemy import func
        
        conv_with_count_query = (
            select(
                Conversation.id,
                Conversation.title,
                Conversation.created_at,
                Conversation.updated_at,
                func.count(Message.id).label("message_count")
            )
            .outerjoin(Message, Conversation.id == Message.conversation_id)
            .where(Conversation.id == conversation_id)
            .group_by(
                Conversation.id,
                Conversation.title,
                Conversation.created_at,
                Conversation.updated_at
            )
        )
        
        conv_result = await db.execute(conv_with_count_query)
        conv_data = conv_result.first()
        
        if not conv_data:
            raise not_found_exception("Conversation", conversation_id)
        
        # Get paginated messages efficiently
        messages_query = (
            select(Message.id, Message.role, Message.content, Message.created_at)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at)
            .offset(offset)
            .limit(limit)
        )
        
        messages_result = await db.execute(messages_query)
        messages_data = messages_result.all()
        
        return {
            "id": conv_data.id,
            "title": conv_data.title,
            "created_at": conv_data.created_at,
            "updated_at": conv_data.updated_at,
            "message_count": conv_data.message_count,
            "messages": [
                {
                    "id": msg.id,
                    "role": msg.role,
                    "content": msg.content,
                    "created_at": msg.created_at
                }
                for msg in messages_data
            ],
            "pagination": {
                "limit": limit,
                "offset": offset,
                "total": conv_data.message_count
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get conversation {conversation_id}: {e}")
        raise internal_server_exception("Failed to retrieve conversation")


@router.delete(
    "/{conversation_id}",
    summary="Delete conversation",
    description="Delete a conversation and all its messages."
)
async def delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    logger: logging.Logger = Depends(get_logger)
):
    """Delete conversation and all its messages."""
    try:
        # Check if conversation exists
        conv_result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = conv_result.scalar_one_or_none()
        
        if not conversation:
            raise not_found_exception("Conversation", conversation_id)
        
        # Delete messages first (cascade should handle this, but being explicit)
        await db.execute(
            delete(Message).where(Message.conversation_id == conversation_id)
        )
        
        # Delete conversation
        await db.execute(
            delete(Conversation).where(Conversation.id == conversation_id)
        )
        
        await db.commit()
        
        return {"message": f"Conversation {conversation_id} deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete conversation {conversation_id}: {e}")
        raise internal_server_exception("Failed to delete conversation")


@router.post(
    "",
    summary="Create new conversation",
    description="Create a new empty conversation."
)
async def create_conversation(
    title: str = "New Conversation",
    db: AsyncSession = Depends(get_db),
    logger: logging.Logger = Depends(get_logger)
):
    """Create a new conversation."""
    try:
        conversation = Conversation(
            id=str(uuid.uuid4()),
            title=title,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        db.add(conversation)
        await db.commit()
        
        return {
            "id": conversation.id,
            "title": conversation.title,
            "created_at": conversation.created_at,
            "updated_at": conversation.updated_at
        }
        
    except Exception as e:
        logger.error(f"Failed to create conversation: {e}")
        raise internal_server_exception("Failed to create conversation")