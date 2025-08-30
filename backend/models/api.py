"""API request/response models."""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Request model for chat endpoint."""
    message: str = Field(..., description="User message/question")
    enable_cva: bool = Field(True, description="Enable claim verification analysis")
    conversation_id: Optional[str] = Field(None, description="Existing conversation ID")
    stream: bool = Field(True, description="Enable streaming response")


class SourceDocument(BaseModel):
    """Source document model."""
    url: str
    title: str
    excerpt: str
    relevance_score: float = Field(ge=0.0, le=1.0)


class Source(BaseModel):
    """Source citation model (legacy support)."""
    url: str
    title: str
    excerpt: str
    relevance_score: float = Field(ge=0.0, le=1.0)


class EvidenceReference(BaseModel):
    """Evidence reference for claim support."""
    source_url: str
    snippet: str
    confidence: float = Field(ge=0.0, le=1.0)
    relevance_score: float = Field(ge=0.0, le=1.0)


class Claim(BaseModel):
    """Claim verification model with evidence references."""
    id: str
    text: str
    confidence: float = Field(ge=0.0, le=1.0)
    evidence_count: int = Field(ge=0)
    has_conflict: bool = False
    uncertainty: bool = False
    evidence_references: List[EvidenceReference] = []
    uncertainty_reason: Optional[str] = None


class ChatResponse(BaseModel):
    """Response model for chat endpoint."""
    response: str
    conversation_id: str
    message_id: str
    sources: List[SourceDocument] = []
    claims: Optional[List[Claim]] = None  # Only if enable_cva=True
    metadata: Dict[str, Any] = {}


class ConversationSummary(BaseModel):
    """Summary model for conversation list."""
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int


class ConversationsResponse(BaseModel):
    """Response model for conversations list."""
    conversations: List[ConversationSummary]
    total_count: int
    page: int
    limit: int


class ErrorResponse(BaseModel):
    """Error response model."""
    error: Dict[str, Any]
    detail: Optional[str] = None