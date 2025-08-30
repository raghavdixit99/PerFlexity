"""Domain models for business objects."""

from typing import List, Optional, Dict, Any
from datetime import datetime
from dataclasses import dataclass
from enum import Enum


class MessageRole(str, Enum):
    """Message role enumeration."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


@dataclass
class Document:
    """Web document model."""
    url: str
    title: str
    content: str
    excerpt: str
    metadata: Dict[str, Any]
    fetched_at: datetime


@dataclass
class Passage:
    """Text passage for retrieval."""
    text: str
    source_url: str
    source_title: str
    relevance_score: float = 0.0
    vector_embedding: Optional[List[float]] = None


@dataclass
class SearchResult:
    """Search result from web search."""
    title: str
    url: str
    snippet: str
    rank: int
    source: str = "unknown"


@dataclass
class EvidenceSpan:
    """Evidence span for claim verification."""
    text: str
    source_url: str
    confidence: float
    start_pos: int = 0
    end_pos: int = 0


@dataclass
class AtomicClaim:
    """Atomic claim for verification."""
    id: str
    text: str
    evidence_spans: List[EvidenceSpan]
    confidence: float = 0.0
    has_conflict: bool = False
    uncertainty: bool = False
    uncertainty_reason: Optional[str] = None


@dataclass
class CVAResult:
    """Claim Verification Analysis result."""
    claims: List[AtomicClaim]
    total_claims: int
    verified_claims: int
    conflicted_claims: int
    uncertain_claims: int
    overall_confidence: float
    processing_time_ms: float


@dataclass
class ConversationContext:
    """Conversation context for LLM."""
    conversation_id: str
    messages: List[Dict[str, str]]
    user_message_id: str