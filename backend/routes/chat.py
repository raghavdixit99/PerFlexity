"""Chat endpoint with streaming support."""

import uuid
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.dependencies import get_db, get_logger
from core.database import Conversation, Message
from core.exceptions import not_found_exception, internal_server_exception
from models.api import ChatRequest, ChatResponse, SourceDocument, Claim
from services.coordinator import get_chat_coordinator, ChatCoordinator
from services.db import create_conversation, get_conversation, save_message, get_conversation_context

router = APIRouter(tags=["Chat"])


@router.post(
    "/ask",
    responses={
        200: {"description": "Streaming response", "content": {"text/event-stream": {}}},
        400: {"description": "Invalid request"},
        500: {"description": "Internal server error"}
    },
    summary="Ask a question with CVA support",
    description="Submit a question and receive a streaming response with claim verification analysis (CVA) enabled by default."
)
async def ask_question(
    chat_request: ChatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    logger: logging.Logger = Depends(get_logger)
):
    """
    Handle chat requests with optional CVA.
    
    Pipeline:
    1. Create/retrieve conversation
    2. Store user message  
    3. Process through coordinator pipeline (search, retrieval, LLM, optional CVA)
    4. Return streaming or JSON response
    """
    logger.info(f"Processing chat request: {chat_request.message[:50]}... (CVA: {chat_request.enable_cva})")
    
    try:
        # Step 1: Handle conversation context
        conversation_id = chat_request.conversation_id
        
        if not conversation_id:
            # Create new conversation
            conversation_id = await create_conversation(db, chat_request.message)
        else:
            # Verify conversation exists
            conversation = await get_conversation(db, conversation_id)
            if not conversation:
                raise not_found_exception("Conversation", conversation_id)
            logger.info(f"Using existing conversation: {conversation_id}")
        
        # Step 2: Store user message
        await save_message(db, conversation_id, "user", chat_request.message)
        
        # Step 3: Get conversation context directly (avoid duplicate DB calls in coordinator)
        context = None
        if conversation_id:
            try:
                context_data = await get_conversation_context(db, conversation_id)
                logger.info(f"Retrieving context: {context_data} for conversation {conversation_id}")
                if context_data and context_data.messages:
                    # Format context for LLM - messages are dicts, not objects
                    context_messages = []
                    for msg in context_data.messages[-4:]:  # Last 4 messages for context
                        role = msg['role']
                        content = msg['content']
                        context_messages.append(f"{role}: {content}")
                    context = "\n".join(context_messages)
                    logger.info(f"✅ Context retrieved: {len(context_messages)} messages")
                    logger.info(f"📋 Context content: {context[:200]}...")
                else:
                    logger.info("📝 No previous messages found")
            except Exception as e:
                logger.warning(f"❌ Context retrieval failed: {e}")
                context = None
        
        # Step 4: Process through coordinator with direct context passing
        coordinator = get_chat_coordinator()
        
        if chat_request.stream:
            # Return streaming response
            return StreamingResponse(
                _stream_pipeline_response(
                    coordinator,
                    chat_request,
                    db,
                    context,
                    conversation_id,
                    logger
                ),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "Access-Control-Allow-Origin": "*"
                }
            )
        else:
            # Collect full response for JSON
            response_text = ""
            sources = []
            claims = []
            metadata = {}
            
            async for token, meta in coordinator.process_chat(
                query=chat_request.message,
                context=context,  # Pass context directly
                enable_cva=chat_request.enable_cva
            ):
                if token:
                    response_text += token
                
                if meta:
                    if "sources" in meta:
                        sources = [SourceDocument(**src) for src in meta["sources"]]
                    if "claims" in meta:
                        claims = [Claim(**claim) for claim in meta["claims"]]
                    metadata.update(meta)
            
            # Save assistant response to database
            if response_text.strip():
                await save_message(db, conversation_id, "assistant", response_text.strip())
                await db.commit()
                logger.info(f"Saved assistant response ({len(response_text)} chars) for conversation {conversation_id}")
            
            return ChatResponse(
                response=response_text,
                conversation_id=conversation_id,
                message_id=str(uuid.uuid4()),  # Generate ID for response tracking
                sources=sources,
                claims=claims if chat_request.enable_cva else None,
                metadata=metadata
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat request failed: {e}")
        raise internal_server_exception(f"Failed to process chat request: {str(e)}")


async def _stream_pipeline_response(
    chat_c: ChatCoordinator,  
    chat_request: ChatRequest,
    db_session: AsyncSession,
    context: Optional[str],
    conversation_id: str,
    logger: logging.Logger
) -> AsyncGenerator[str, None]:
    """Stream pipeline response as Server-Sent Events."""
    try:
        message_id = str(uuid.uuid4())
        assistant_response = ""  # Accumulate assistant response
        
        # Send initial metadata
        import json
        start_data = {"type": "start", "conversation_id": conversation_id, "message_id": message_id}
        yield f"data: {json.dumps(start_data)}\n\n"
        
        # Stream pipeline response
        async for token, metadata in chat_c.process_chat(
            query=chat_request.message,
            context=context,
            enable_cva=chat_request.enable_cva
        ):
            if token:
                # Accumulate assistant response
                assistant_response += token
                # Send token
                token_data = {"type": "token", "content": token}
                yield f"data: {json.dumps(token_data)}\n\n"
            
            if metadata:
                # Send metadata events
                if "sources" in metadata:
                    sources_data = {"type": "sources", "sources": metadata["sources"]}
                    yield f"data: {json.dumps(sources_data)}\n\n"
                
                if "claims" in metadata:
                    claims_data = {"type": "claims", "claims": metadata["claims"]}
                    yield f"data: {json.dumps(claims_data)}\n\n"
                
                if "error" in metadata:
                    error_data = {"type": "error", "error": metadata["error"]}
                    yield f"data: {json.dumps(error_data)}\n\n"
        
        # Save assistant response to database
        if assistant_response.strip():
            await save_message(db_session, conversation_id, "assistant", assistant_response.strip())
            await db_session.commit()
            logger.info(f"Saved assistant response ({len(assistant_response)} chars) for conversation {conversation_id}")
        
        # Send completion
        done_data = {"type": "done", "conversation_id": conversation_id}
        yield f"data: {json.dumps(done_data)}\n\n"
        
    except Exception as e:
        logger.error(f"Streaming failed: {e}")
        error_data = {"type": "error", "error": f"Streaming failed: {str(e)}"}
        yield f"data: {json.dumps(error_data)}\n\n"


