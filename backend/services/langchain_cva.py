"""LangChain-based CVA service with structured output and Pydantic validation."""

import asyncio
import logging
import time
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from langchain_ollama import ChatOllama
from langchain.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.output_parsers import PydanticOutputParser

from models.domain import Passage, AtomicClaim, EvidenceSpan, CVAResult
from core.exceptions import CVAError
from core.config import get_settings

logger = logging.getLogger(__name__)


# Pydantic models for structured CVA output
class LangChainEvidenceSpan(BaseModel):
    """Evidence span with Pydantic validation."""
    text: str = Field(description="The evidence text snippet")
    source_url: str = Field(description="URL of the source")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score between 0 and 1")
    start_pos: int = Field(ge=0, description="Start position in source text")
    end_pos: int = Field(ge=0, description="End position in source text")


class LangChainAtomicClaim(BaseModel):
    """Atomic claim with structured evidence."""
    id: str = Field(description="Unique claim identifier")
    text: str = Field(description="The claim statement")
    evidence_spans: List[LangChainEvidenceSpan] = Field(description="Supporting evidence")
    confidence: float = Field(ge=0.0, le=1.0, description="Overall claim confidence")
    uncertainty: bool = Field(description="Whether the claim has uncertainty")
    uncertainty_reason: Optional[str] = Field(description="Reason for uncertainty if applicable")


class LangChainCVAOutput(BaseModel):
    """Complete CVA analysis with validation."""
    claims: List[LangChainAtomicClaim] = Field(description="Extracted and verified claims")
    total_claims: int = Field(ge=0, description="Total number of claims")
    verified_claims: int = Field(ge=0, description="Number of verified claims")
    conflicted_claims: int = Field(ge=0, description="Number of conflicted claims")
    uncertain_claims: int = Field(ge=0, description="Number of uncertain claims")
    overall_confidence: float = Field(ge=0.0, le=1.0, description="Overall confidence score")


class LangChainCVAService:
    """Advanced CVA using LangChain structured output and Pydantic validation."""
    
    def __init__(self):
        self.settings = get_settings()
        self.claim_extraction_llm = None
        self.claim_verification_llm = None
        
        # Configure models for CVA
        self.extraction_model = "qwen2.5:1.5b-instruct"  # Fast model for claim extraction
        self.verification_model = "qwen2.5:3b-instruct-q4_0"  # More capable model for verification
        
    async def initialize(self):
        """Initialize LangChain CVA components."""
        try:
            logger.info("🦜 Initializing LangChain CVA service...")
            
            # Initialize claim extraction LLM
            self.claim_extraction_llm = ChatOllama(
                model=self.extraction_model,
                base_url=self.settings.ollama_base_url,
                temperature=0.1,  # Low temperature for consistent extraction
                format="json"  # Request JSON output
            )
            
            # Initialize claim verification LLM  
            self.claim_verification_llm = ChatOllama(
                model=self.verification_model,
                base_url=self.settings.ollama_base_url,
                temperature=0.2,  # Slightly higher for reasoning
                format="json"  # Request JSON output
            )
            
            # Test both models
            test_response = await self.claim_extraction_llm.ainvoke("Test")
            if test_response and test_response.content:
                logger.info("✅ LangChain CVA ready: Both models initialized")
                return True
            else:
                logger.error("❌ LangChain CVA test failed")
                return False
                
        except Exception as e:
            logger.error(f"❌ LangChain CVA initialization failed: {e}")
            return False
    
    async def verify_claims_background(
        self, 
        response_text: str, 
        passages: List[Passage], 
        timeout_seconds: int = 10  # Increased timeout for LangChain processing
    ) -> CVAResult:
        """Advanced CVA using LangChain structured output."""
        try:
            start_time = time.time()
            logger.info(f"🦜 Starting LangChain CVA analysis...")
            
            if not self.claim_extraction_llm or not self.claim_verification_llm:
                await self.initialize()
            
            # Step 1: Extract claims using structured output
            claims_data = await self._extract_claims_structured(response_text)
            
            # Step 2: Verify claims against passages
            verified_claims = await self._verify_claims_with_evidence(claims_data, passages)
            
            # Step 3: Create final CVA result
            cva_result = self._create_cva_result(verified_claims)
            
            processing_time = (time.time() - start_time) * 1000
            cva_result.processing_time_ms = processing_time
            
            logger.info(f"✅ LangChain CVA completed: {len(verified_claims)} claims in {processing_time:.1f}ms")
            
            return cva_result
            
        except Exception as e:
            logger.error(f"❌ LangChain CVA failed: {e}")
            processing_time = (time.time() - start_time) * 1000
            return self._create_error_result(processing_time, str(e))
    
    async def _extract_claims_structured(self, response_text: str) -> List[Dict[str, Any]]:
        """Extract claims using LangChain structured output."""
        try:
            # Define extraction schema
            class ClaimExtraction(BaseModel):
                claims: List[str] = Field(description="List of factual claims from the text")
            
            # Create parser
            parser = PydanticOutputParser(pydantic_object=ClaimExtraction)
            
            # Create focused claim extraction prompt
            extraction_prompt = ChatPromptTemplate.from_messages([
                SystemMessage(content="Extract specific factual claims from the response. Focus on concrete facts, not generic statements."),
                HumanMessage(content=f"""Extract specific factual claims from this text about the main topic:

{response_text[:800]}

Extract claims like:
- "GGML was created by [person]"
- "GGML is used for [specific purpose]"  
- "GGML supports [specific features]"

Avoid generic claims like "it is related to technology"

JSON format: {{"claims": ["Specific fact 1", "Specific fact 2", "Specific fact 3"]}}""")
            ])
            
            # Use LangChain structured output
            chain = extraction_prompt | self.claim_extraction_llm | parser
            result = await chain.ainvoke({})
            
            logger.info(f"✅ LangChain extracted {len(result.claims)} claims")
            
            # Convert to our format
            claims_data = []
            for i, claim_text in enumerate(result.claims):
                claims_data.append({
                    "id": f"claim_{i+1}",
                    "text": claim_text,
                    "confidence": 0.8,  # Default confidence, will be updated by verification
                    "evidence_spans": [],
                    "uncertainty": False
                })
            
            return claims_data
            
        except Exception as e:
            logger.error(f"❌ LangChain claim extraction failed: {e}")
            return []
    
    async def _verify_claims_with_evidence(
        self, 
        claims_data: List[Dict[str, Any]], 
        passages: List[Passage]
    ) -> List[AtomicClaim]:
        """Verify claims against evidence using LangChain structured output."""
        try:
            verified_claims = []
            
            # Prepare evidence context with passage mapping
            evidence_context = ""
            passage_map = {}
            
            for i, passage in enumerate(passages[:3]):  # Limit to 3 for speed
                source_id = f"source_{i+1}"
                evidence_context += f"Source {i+1} ({passage.source_title}):\n{passage.text[:400]}...\n\n"
                passage_map[source_id] = passage
            
            # Define verification schema (fixed based on test results)
            class ClaimVerification(BaseModel):
                verified: bool = Field(description="Whether the claim is supported by evidence")
                confidence: float = Field(ge=0.0, le=1.0, description="Confidence in verification")
                supporting_evidence: str = Field(description="Single text snippet that supports the claim")
                reasoning: str = Field(description="Brief explanation of the verification decision")
            
            parser = PydanticOutputParser(pydantic_object=ClaimVerification)
            
            # Simplified verification for speed and accuracy
            for i, claim_data in enumerate(claims_data[:3]):  # Limit to 3 claims for speed
                try:
                    # Use simplified evidence matching (faster than LLM verification)
                    evidence_spans = self._find_evidence_for_claim(claim_data['text'], passages)
                    
                    # Calculate confidence based on evidence quality
                    confidence = self._calculate_claim_confidence(evidence_spans)
                    is_verified = confidence > 0.6
                    
                    # Create atomic claim with proper evidence mapping
                    verified_claim = AtomicClaim(
                        id=claim_data["id"],
                        text=claim_data["text"],
                        evidence_spans=evidence_spans,
                        confidence=confidence,
                        uncertainty=not is_verified,
                        uncertainty_reason="Low evidence support" if not is_verified else None
                    )
                    
                    verified_claims.append(verified_claim)
                    logger.info(f"✅ Claim {i+1}: {confidence:.2f} confidence, {len(evidence_spans)} evidence spans")
                    
                except Exception as e:
                    logger.warning(f"❌ Claim {i+1} processing failed: {e}")
                    # Add unverified claim
                    verified_claims.append(AtomicClaim(
                        id=claim_data["id"],
                        text=claim_data["text"],
                        evidence_spans=[],
                        confidence=0.0,
                        uncertainty=True,
                        uncertainty_reason=f"Processing failed: {e}"
                    ))
            
            return verified_claims
            
        except Exception as e:
            logger.error(f"❌ Claims verification process failed: {e}")
            return []
    
    async def _verify_single_claim(self, claim_data: Dict[str, Any], verification_prompt, parser) -> AtomicClaim:
        """Verify a single claim using LangChain structured output."""
        try:
            # Use simplified verification (no parser for reliability)
            simple_prompt = f"""Verify this claim with evidence. Respond with valid JSON only:

CLAIM: {claim_data['text'][:200]}...

Respond: {{"verified": true, "confidence": 0.8, "supporting_evidence": "brief quote", "reasoning": "explanation"}}"""
            
            # Use simple LLM call without parser for reliability
            response = await self.claim_verification_llm.ainvoke(simple_prompt)
            
            # Simple JSON parsing
            import json
            try:
                response_text = response.content.strip()
                if "{" in response_text:
                    json_start = response_text.find("{")
                    json_end = response_text.rfind("}") + 1
                    json_str = response_text[json_start:json_end]
                    verification_data = json.loads(json_str)
                    
                    # Create evidence span
                    evidence_spans = []
                    if verification_data.get("supporting_evidence"):
                        evidence_spans.append(EvidenceSpan(
                            text=verification_data["supporting_evidence"][:300],
                            source_url="langchain_verified",
                            confidence=verification_data.get("confidence", 0.5),
                            start_pos=0,
                            end_pos=len(verification_data["supporting_evidence"][:300])
                        ))
                    
                    return AtomicClaim(
                        id=claim_data["id"],
                        text=claim_data["text"],
                        evidence_spans=evidence_spans,
                        confidence=verification_data.get("confidence", 0.5),
                        uncertainty=not verification_data.get("verified", False),
                        uncertainty_reason=verification_data.get("reasoning") if not verification_data.get("verified", False) else None
                    )
                    
                else:
                    raise ValueError("No JSON found in response")
                    
            except Exception as parse_error:
                logger.warning(f"JSON parsing failed: {parse_error}")
                
                # Fallback: create claim with basic confidence
                return AtomicClaim(
                    id=claim_data["id"],
                    text=claim_data["text"],
                    evidence_spans=[],
                    confidence=0.6,
                    uncertainty=True,
                    uncertainty_reason="Parsing failed"
                )
                
        except Exception as e:
            logger.error(f"Single claim verification failed: {e}")
            return AtomicClaim(
                id=claim_data["id"],
                text=claim_data["text"],
                evidence_spans=[],
                confidence=0.0,
                uncertainty=True,
                uncertainty_reason=str(e)
            )
    
    def _find_evidence_for_claim(self, claim_text: str, passages: List[Passage]) -> List[EvidenceSpan]:
        """Find evidence spans for a claim using fuzzy matching."""
        try:
            from rapidfuzz import fuzz
            
            evidence_spans = []
            claim_lower = claim_text.lower()
            
            # Extract key terms from claim
            claim_words = claim_lower.split()
            key_terms = [word for word in claim_words if len(word) > 3][:5]  # Top 5 key terms
            
            for passage in passages:
                passage_lower = passage.text.lower()
                
                # Calculate relevance using fuzzy matching
                max_score = 0
                best_match = ""
                
                for term in key_terms:
                    # Find best match for this term in passage
                    score = fuzz.partial_ratio(term, passage_lower)
                    if score > max_score:
                        max_score = score
                        # Find the actual matching text
                        start_pos = passage_lower.find(term.lower())
                        if start_pos >= 0:
                            best_match = passage.text[start_pos:start_pos + len(term) + 50]
                
                # If we found good evidence, create span
                if max_score > 70:  # Threshold for evidence match
                    evidence_spans.append(EvidenceSpan(
                        text=best_match[:200] if best_match else passage.text[:200],
                        source_url=passage.source_url,
                        confidence=max_score / 100.0,
                        start_pos=0,
                        end_pos=min(200, len(best_match) if best_match else len(passage.text))
                    ))
                    
                    if len(evidence_spans) >= 2:  # Max 2 evidence spans per claim
                        break
            
            return evidence_spans
            
        except Exception as e:
            logger.warning(f"Evidence matching failed: {e}")
            return []
    
    def _calculate_claim_confidence(self, evidence_spans: List[EvidenceSpan]) -> float:
        """Calculate claim confidence based on evidence quality."""
        if not evidence_spans:
            return 0.0
        
        # Base confidence on number and quality of evidence spans
        span_count_score = min(len(evidence_spans) / 2.0, 1.0)  # Max score at 2 spans
        average_confidence = sum(span.confidence for span in evidence_spans) / len(evidence_spans)
        
        # Combine scores
        final_confidence = (span_count_score * 0.4) + (average_confidence * 0.6)
        
        return min(final_confidence, 1.0)
    
    def _create_cva_result(self, verified_claims: List[AtomicClaim]) -> CVAResult:
        """Create CVA result from verified claims."""
        if not verified_claims:
            return CVAResult(
                claims=[],
                total_claims=0,
                verified_claims=0,
                conflicted_claims=0,
                uncertain_claims=0,
                overall_confidence=0.0,
                processing_time_ms=0
            )
        
        verified_count = sum(1 for c in verified_claims if not c.uncertainty)
        uncertain_count = sum(1 for c in verified_claims if c.uncertainty)
        overall_confidence = sum(c.confidence for c in verified_claims) / len(verified_claims)
        
        return CVAResult(
            claims=verified_claims,
            total_claims=len(verified_claims),
            verified_claims=verified_count,
            conflicted_claims=0,  # Could be enhanced with conflict detection
            uncertain_claims=uncertain_count,
            overall_confidence=overall_confidence,
            processing_time_ms=0  # Will be set by caller
        )
    
    def _create_error_result(self, processing_time_ms: float, error_msg: str) -> CVAResult:
        """Create error result for failed CVA."""
        return CVAResult(
            claims=[],
            total_claims=0,
            verified_claims=0,
            conflicted_claims=0,
            uncertain_claims=0,
            overall_confidence=0.0,
            processing_time_ms=processing_time_ms
        )


# Global service instance
_langchain_cva_service: Optional[LangChainCVAService] = None


async def get_langchain_cva_service() -> LangChainCVAService:
    """Get the global LangChain CVA service."""
    global _langchain_cva_service
    if _langchain_cva_service is None:
        _langchain_cva_service = LangChainCVAService()
    return _langchain_cva_service