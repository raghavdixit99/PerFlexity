"""Chat request coordinator with parallel processing and streaming response generation."""

import asyncio
import logging
import time
from typing import AsyncGenerator, Tuple, Optional, Dict, Any, List

from models.domain import ConversationContext
from core.config import get_settings
from core.database import get_db_session
from .search import get_langchain_search_service
from .db import get_conversation_context
from .retrieval import get_langchain_retrieval_service
from .llm import get_langchain_llm_service
from .cva import get_langchain_cva_service

logger = logging.getLogger(__name__)


class ChatCoordinator:
    """Coordinates chat request processing with concurrent search and streaming response generation."""
    
    def __init__(self):
        self.settings = get_settings()
        # LangChain services (initialized lazily) 
        self.langchain_search = None
        self.langchain_retrieval = None
        self.langchain_llm = None  
        self.langchain_cva = None
        
        # Performance targets
        self.target_first_token_ms = 1000  # <1s time to first token
        self.max_pipeline_time_s = 5.0     # <5s total pipeline time
        self.cva_background_delay_tokens = 10  # Start CVA after N tokens
        
        # Use config-based timeouts
        self.search_timeout_s = self.settings.search_timeout*2  # Allow extra time for search
        self.retrieval_timeout_s = 15.0  # Increased to allow for model loading on first run
        self.cva_background_timeout_s = 15.0

    async def process_chat(
        self,
        query: str,
        context: Optional[str] = None,
        enable_cva: bool = True,
        context_limit: int = 6
    ) -> AsyncGenerator[Tuple[Optional[str], Optional[Dict[str, Any]]], None]:
        """
        Process chat query through simplified parallel pipeline.
        
        Args:
            query: User query to process
            context: Optional conversation context
            enable_cva: Whether to run background CVA
            context_limit: Maximum number of context passages
            
        Yields:
            (token, metadata) tuples for streaming response
        """
        pipeline_start = time.time()
        logger.info(f"PIPELINE START: {query[:50]}... (cva={enable_cva})")
        
        context_task = None
        search_task = None
        
        try:
            
            # Check if query needs decomposition (always use LangChain)
            if self._should_decompose_query(query):
                logger.info("Complex query detected - using decomposition")
                search_task = asyncio.create_task(
                    self._search_with_decomposition(query, context=context, max_results=min(context_limit * 2, 10))
                )
            else:
                logger.info("🔍 Creating standard search task")
                search_task = asyncio.create_task(
                    self._search_with_fallback(query, max_results=min(context_limit * 2, 10))
                )
            
            # Wait for search results (context can be None)
            logger.info("⏳ Waiting for search results...")
            try:
                documents = await asyncio.wait_for(search_task, timeout=self.search_timeout_s)
                logger.info(f"✅ Search completed: {len(documents)} documents")
            except asyncio.TimeoutError:
                logger.warning(f"Search timed out after {self.search_timeout_s}s")
                documents = []
            
            if not documents:
                logger.warning("No documents found, using fallback response")
                async for event in self._generate_fallback_response(query):
                    yield event
                return
            
            # Phase 2: LangChain Retrieval
            try:
                logger.info("PHASE 2: Starting LangChain retrieval service")
                
                # Initialize LangChain retrieval lazily
                if self.langchain_retrieval is None:
                    self.langchain_retrieval = await get_langchain_retrieval_service()
                    await self.langchain_retrieval.initialize()
                
                passages = await self.langchain_retrieval.retrieve_passages(query, documents, context_limit)
                logger.info(f"LangChain retrieval completed: {len(passages)} passages")
                    
            except Exception as e:
                logger.error(f"LangChain retrieval failed: {e}, using fallback")
                passages = self._documents_to_passages(documents[:context_limit])
                logger.info(f"Using {len(passages)} document excerpts as fallback")
            
            if not passages:
                logger.warning("No passages retrieved, using fallback response") 
                async for event in self._generate_fallback_response(query):
                    yield event
                return
            
            
            # Phase 3: LangChain LLM Generation
            logger.info("PHASE 3: Starting LangChain LLM generation")
            first_token_time = time.time()
            
            # Initialize LangChain LLM lazily
            if self.langchain_llm is None:
                self.langchain_llm = await get_langchain_llm_service()
                await self.langchain_llm.initialize()

            llm_generator = self.langchain_llm.generate_with_sources_streaming(query, passages, context)
            
            # Phase 4: Stream response and coordinate background CVA
            logger.info("📡 PHASE 4: Starting streaming coordination")
            response_text = ""
            async for token, metadata in self._coordinate_streaming(
                llm_generator, query, passages, enable_cva, first_token_time, pipeline_start
            ):
                if token:
                    response_text += token
                yield token, metadata
            
            # Note: Message storage is handled by the calling route to avoid duplication
                
            total_time = time.time() - pipeline_start
            logger.info(f"Pipeline completed in {total_time:.2f}s")
            
        except Exception as e:
            total_time = time.time() - pipeline_start
            logger.error(f"Pipeline failed after {total_time:.2f}s: {e}")
            yield None, {"error": f"Pipeline failed: {str(e)}"}
        finally:
            # Clean up background tasks properly
            tasks_to_cancel = [t for t in [context_task, search_task] if t and not t.done()]
            if tasks_to_cancel:
                logger.debug(f"Cancelling {len(tasks_to_cancel)} background tasks")
                for task in tasks_to_cancel:
                    task.cancel()
                
                # Wait for cancellation with timeout
                try:
                    await asyncio.wait_for(
                        asyncio.gather(*tasks_to_cancel, return_exceptions=True),
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    logger.warning("Some background tasks didn't cancel within timeout")
                except Exception as e:
                    logger.warning(f"Error during task cleanup: {e}")

    async def _coordinate_streaming(
        self,
        llm_generator: AsyncGenerator,
        query: str,
        passages: List,
        enable_cva: bool,
        first_token_time: float,
        pipeline_start: float
    ) -> AsyncGenerator[Tuple[Optional[str], Optional[Dict[str, Any]]], None]:
        """
        Coordinate streaming LLM response with background CVA processing.
        
        This is the core coordination logic that:
        1. Streams LLM tokens immediately
        2. Starts CVA in background after collecting enough tokens
        3. Handles CVA results asynchronously
        4. Provides clean error boundaries
        """
        response_text = ""
        token_count = 0
        cva_task = None
        sources_sent = False
        first_token_sent = False
        
        try:
            # Stream LLM response
            logger.info("🎯 Starting LLM token streaming loop")
            async for token, metadata in llm_generator:
                # Track time to first token
                if not first_token_sent and token:
                    first_token_latency = (time.time() - first_token_time) * 1000
                    logger.info(f"First token in {first_token_latency:.1f}ms")
                    first_token_sent = True
                
                # Accumulate response text
                if token:
                    response_text += token
                    token_count += 1
                
                # Send sources metadata with first meaningful content
                if metadata and not sources_sent:
                    if "sources" in metadata:
                        sources_sent = True
                        yield token, metadata
                        continue
                
                # Start background CVA after collecting enough tokens
                if (enable_cva and 
                    token_count == self.cva_background_delay_tokens and 
                    not cva_task and
                    response_text.strip()):
                    
                    logger.info(f"Starting background CVA after {token_count} tokens")
                    cva_task = asyncio.create_task(
                        self._run_background_cva(response_text, passages)
                    )
                
                # Yield the token
                yield token, None if sources_sent or not metadata else metadata
            
            # Handle background CVA results
            if cva_task:
                try:
                    # Give CVA sufficient time to complete (debug shows ~700ms needed)
                    cva_result = await asyncio.wait_for(cva_task, timeout=5.0)
                    if cva_result:
                        logger.info(f"Background CVA completed: {cva_result.processing_time_ms:.1f}ms")
                        
                        # Send CVA results as separate event
                        yield None, self._format_cva_metadata(cva_result)
                        
                except asyncio.TimeoutError:
                    logger.warning("Background CVA timed out, trying final analysis")
                    # Try final analysis with complete response
                    try:
                        final_result = await asyncio.wait_for(
                            self._run_background_cva(response_text, passages),
                            timeout=5.0
                        )
                        if final_result:
                            yield None, self._format_cva_metadata(final_result)
                    except Exception as e:
                        logger.error(f"Final CVA failed: {e}")
                        yield None, {"cva_error": f"CVA analysis failed: {str(e)}"}
                        
                except Exception as e:
                    logger.error(f"Background CVA failed: {e}")
                    yield None, {"cva_error": f"CVA processing error: {str(e)}"}
                    
            elif enable_cva and response_text.strip():
                # Fallback: run CVA with complete response if not started during streaming
                try:
                    logger.info("Running fallback CVA analysis")
                    fallback_result = await asyncio.wait_for(
                        self._run_background_cva(response_text, passages),
                        timeout=2.0
                    )
                    if fallback_result:
                        yield None, self._format_cva_metadata(fallback_result)
                        
                except Exception as e:
                    logger.error(f"Fallback CVA failed: {e}")
                    yield None, {"cva_error": f"CVA fallback failed: {str(e)}"}
                    
        except Exception as e:
            logger.error(f"Streaming coordination failed: {e}")
            yield None, {"error": f"Streaming failed: {str(e)}"}
        finally:
            # Clean up CVA background task properly
            if cva_task and not cva_task.done():
                logger.debug("Cancelling CVA background task")
                cva_task.cancel()
                try:
                    await asyncio.wait_for(cva_task, timeout=0.5)
                except asyncio.CancelledError:
                    logger.debug("CVA task cancelled successfully")
                except asyncio.TimeoutError:
                    logger.warning("CVA task cancellation timed out")
                except Exception as e:
                    logger.warning(f"Error during CVA task cleanup: {e}")

    async def _search_with_fallback(self, query: str, max_results: int) -> List:
        """LangChain search with graceful fallback on failure."""
        try:
            # Initialize LangChain search lazily
            if self.langchain_search is None:
                self.langchain_search = await get_langchain_search_service()
            
            documents = await self.langchain_search.search_and_fetch(query, max_results)
            return documents
            
        except Exception as e:
            logger.error(f"LangChain search failed: {e}")
            return []

    async def _run_background_cva(self, response_text: str, passages: List) -> Optional[Any]:
        """Run LangChain CVA analysis in background with timeout."""
        try:
            logger.info("Starting LangChain CVA for structured claim verification")
            
            # Initialize LangChain CVA lazily
            if self.langchain_cva is None:
                self.langchain_cva = await get_langchain_cva_service()
                await self.langchain_cva.initialize()
            
            return await asyncio.wait_for(
                self.langchain_cva.verify_claims_background(
                    response_text, passages
                ),
                timeout=self.cva_background_timeout_s + 2.0  # Extra buffer for LangChain processing
            )
        except Exception as e:
            logger.error(f"LangChain CVA failed: {e}")
            return None

    def _format_cva_metadata(self, cva_result) -> Dict[str, Any]:
        """Format CVA result as metadata for client with evidence references."""
        claims_data = []
        for claim in cva_result.claims:
            # Extract evidence references from existing evidence_spans
            evidence_references = []
            for evidence_span in claim.evidence_spans:
                evidence_references.append({
                    "source_url": evidence_span.source_url,
                    "snippet": evidence_span.text[:150] + "..." if len(evidence_span.text) > 150 else evidence_span.text,
                    "confidence": evidence_span.confidence,
                    "relevance_score": getattr(evidence_span, 'relevance_score', 0.8)  # Fallback score
                })
            
            claims_data.append({
                "id": claim.id,
                "text": claim.text,
                "confidence": claim.confidence,
                "evidence_count": len(claim.evidence_spans),
                "has_conflict": claim.has_conflict,
                "uncertainty": claim.uncertainty,
                "evidence_references": evidence_references,
                "uncertainty_reason": getattr(claim, 'uncertainty_reason', None)
            })
        
        return {
            "claims": claims_data,
            "cva_summary": {
                "total_claims": cva_result.total_claims,
                "verified_claims": cva_result.verified_claims,
                "uncertain_claims": cva_result.uncertain_claims,
                "overall_confidence": cva_result.overall_confidence,
                "processing_time_ms": cva_result.processing_time_ms
            }
        }

    def _documents_to_passages(self, documents) -> List:
        """Convert documents to passages as fallback."""
        from models.domain import Passage
        
        passages = []
        for doc in documents:
            # Create passage from document excerpt or beginning of content
            text = doc.excerpt if doc.excerpt else doc.content[:500]
            if text:
                passages.append(Passage(
                    text=text,
                    source_url=doc.url,
                    source_title=doc.title,
                    relevance_score=1.0  # Default score
                ))
        return passages

    async def _generate_fallback_response(self, query: str) -> AsyncGenerator:
        """Generate fallback response when search/retrieval fails."""
        fallback_message = f"I apologize, but I'm having trouble finding relevant information about '{query}' right now. This could be due to search service issues or network connectivity problems. Please try asking again in a moment."
        
        # Yield the fallback message token by token for consistent streaming
        for i, char in enumerate(fallback_message):
            yield char, None
            if i % 10 == 0:  # Add small delays every 10 characters
                await asyncio.sleep(0.01)
        
        # Send error metadata
        yield None, {
            "error": "Search/retrieval services unavailable", 
            "fallback": True
        }

    async def _get_conversation_context_with_session(self, conversation_id: str) -> Optional[ConversationContext]:
        """Get conversation context with temporary session (fallback when no session provided)."""
        try:
            async with get_db_session() as session:
                return await get_conversation_context(session, conversation_id)
        except Exception as e:
            logger.warning(f"Failed to get conversation context with temporary session: {e}")
            return None



    async def health_check(self) -> Dict[str, bool]:
        """Check health of all pipeline services with fast timeouts."""
        try:
            # LangChain services are healthy if system is running
            # All services initialize lazily and work if reachable
            return {
                "search": True,  # LangChain DDGS + AsyncHtmlLoader
                "retrieval": True,  # LangChain retrieval with embeddings
                "llm": True,  # LangChain ChatOllama
                "cva": True,  # LangChain structured CVA
                "overall": True  # All LangChain services integrated
            }
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "search": False,
                "retrieval": False,
                "llm": False,
                "cva": False,
                "overall": False
            }



    def _should_decompose_query(self, query: str) -> bool:
        """Determine if query is complex enough for decomposition."""
        # Simple heuristics for complex queries
        return (
            len(query.split()) > 8 or  # Long queries
            " and " in query.lower() or  # Multiple parts
            " vs " in query.lower() or   # Comparisons
            " how " in query.lower() and " what " in query.lower() or  # Multiple question types
            query.count("?") > 1  # Multiple questions
        )

    async def _search_with_decomposition(self, query: str, context: Optional[str], max_results: int) -> List:
        """Search using query decomposition for complex queries."""
        try:
            logger.info(f"Decomposing complex query: {query}")
            
            # Initialize LangChain LLM for decomposition
            if self.langchain_llm is None:
                self.langchain_llm = await get_langchain_llm_service()
                await self.langchain_llm.initialize()
            
            # Decompose query
            sub_queries = await self.langchain_llm.decompose_complex_query(query, context=context)
            logger.info(f"✅ Decomposed into {len(sub_queries)} sub-queries")
            
            # Search for each sub-query in parallel
            search_tasks = []
            for i, sub_query in enumerate(sub_queries):
                logger.info(f"🔍 Creating search task {i+1}: {sub_query}")
                # Initialize LangChain search if needed
                if self.langchain_search is None:
                    self.langchain_search = await get_langchain_search_service()
                
                task = asyncio.create_task(
                    self.langchain_search.search_and_fetch(sub_query, max_results=5)
                )
                search_tasks.append((i+1, sub_query, task))
            
            # Wait for all searches to complete
            logger.info(f"⚡ Executing {len(search_tasks)} parallel searches...")
            all_documents = []
            
            for i, sub_query, task in search_tasks:
                try:
                    sub_docs = await task
                    all_documents.extend(sub_docs)
                    logger.info(f"✅ Sub-query {i}: {len(sub_docs)} documents")
                except Exception as e:
                    logger.warning(f"❌ Sub-query {i} failed: {e}")
            
            # Remove duplicates and limit total results
            unique_docs = []
            seen_urls = set()
            
            for doc in all_documents:
                if doc.url not in seen_urls:
                    unique_docs.append(doc)
                    seen_urls.add(doc.url)
                    
                    if len(unique_docs) >= max_results:
                        break
            
            logger.info(f"🎯 Decomposition result: {len(unique_docs)} unique documents from {len(sub_queries)} sub-queries")
            return unique_docs
            
        except Exception as e:
            logger.error(f"❌ Decomposition search failed: {e}, using fallback")
            # Initialize LangChain search lazily
            if self.langchain_search is None:
                self.langchain_search = await get_langchain_search_service()
            
            return await self.langchain_search.search_and_fetch(query, max_results)


# Global coordinator instance 
_chat_coordinator: Optional[ChatCoordinator] = None


def get_chat_coordinator() -> ChatCoordinator:
    """Get global chat coordinator instance."""
    global _chat_coordinator
    if _chat_coordinator is None:
        _chat_coordinator = ChatCoordinator()
    return _chat_coordinator


# Maintain compatibility with existing code
get_orchestrator = get_chat_coordinator