"""LangChain-based LLM service with streaming and query decomposition."""

import asyncio
import logging
import time
from typing import List, Optional, AsyncGenerator, Tuple, Dict, Any

from langchain_ollama import ChatOllama
from langchain.prompts import PromptTemplate, ChatPromptTemplate
from langchain_core.messages import HumanMessage, SystemMessage

from models.domain import Passage
from core.config import get_settings

logger = logging.getLogger(__name__)


class LangChainLLMService:
    """LangChain-based LLM service with streaming, query decomposition, and RAG."""
    
    def __init__(self):
        self.settings = get_settings()
        self.chat_llm = None
        self.decomposition_llm = None
        
        # Configure models
        self.main_model = self.settings.llm_model  # Main chat model
        self.decomp_model = self.settings.cva_claim_model  # Faster model for decomposition

    async def initialize(self):
        """Initialize LangChain LLM components."""
        try:
            logger.info("🦜 Initializing LangChain LLM service...")
            
            # Main chat LLM with streaming
            self.chat_llm = ChatOllama(
                model=self.main_model,
                base_url=self.settings.ollama_base_url,
                temperature=0.2,
                top_p=0.9,
            )
            
            # Decomposition LLM (faster, smaller model)
            self.decomposition_llm = ChatOllama(
                model=self.decomp_model,
                base_url=self.settings.ollama_base_url,
                temperature=0.1,  # Lower temperature for more focused decomposition
                top_p=0.9,
            )
            
            # Test both models
            test_response = await self.chat_llm.ainvoke("Test")
            if test_response and test_response.content:
                logger.info(f"✅ LangChain LLM ready: {self.main_model}")
                return True
            else:
                logger.error("❌ LangChain LLM test failed")
                return False
                
        except Exception as e:
            logger.error(f"❌ LangChain LLM initialization failed: {e}")
            return False


    async def decompose_complex_query(self, query: str, context: str) -> List[str]:
        """Decompose complex queries into simpler sub-questions."""
        try:
            # Check if query is complex enough to warrant decomposition
            if len(query.split()) < 6 and " and " not in query.lower() and "?" not in query[:-1]:
                return [query]  # Simple query, no decomposition needed
            
            logger.info(f"🧠 Decomposing complex query: {query}")
            
            decomposition_prompt = ChatPromptTemplate.from_messages([
                SystemMessage(content="You are a query decomposition expert. Break complex questions into 2-3 simpler sub-questions. use the provided context for clear understanding."),
                HumanMessage(content=f""" Given context :
{context}
Break the below query into simpler sub-questions:
{query}
Return only the sub-questions, numbered 1. 2. 3. etc. and separated by new lines (\\n)""")
            ])
            
            response = await self.decomposition_llm.ainvoke(decomposition_prompt.format_messages())
            
            # Parse sub-questions
            lines = response.content.split('\n')
            sub_questions = []
            
            for line in lines:
                line = line.strip()
                if line and any(line.startswith(f'{i}.') for i in range(1, 6)):
                    # Extract question after number
                    sub_q = line[2:].strip()
                    if len(sub_q) > 5:
                        sub_questions.append(sub_q)
            
            if not sub_questions:
                sub_questions = [query]  # Fallback

            logger.info(f"✅ Decomposed into {len(sub_questions)} sub-questions : {sub_questions} \n\n")
            return sub_questions[:3]  # Max 3 sub-questions
            
        except Exception as e:
            logger.warning(f"Query decomposition failed: {e}, using original query")
            return [query]
    
    async def generate_with_sources_streaming(
        self, 
        query: str, 
        passages: List[Passage], 
        context: Optional[str] = None
    ) -> AsyncGenerator[Tuple[Optional[str], Optional[Dict[str, Any]]], None]:
        """Generate streaming response with source integration using LangChain."""
        try:
            if not self.chat_llm:
                await self.initialize()
            
            logger.info(f"🤖 Starting LangChain streaming generation for: {query[:50]}...")
            
            # Prepare context from passages
            source_context = ""
            if passages:
                source_texts = []
                for i, passage in enumerate(passages[:5]):  # Top 5 passages
                    source_texts.append(f"Source {i+1} ({passage.source_title}):\n{passage.text[:300]}...")
                
                source_context = "\n\n".join(source_texts)
            
            # Add conversation context if provided
            full_context = ""
            if context:
                full_context += f"Previous conversation:\n{context}\n\n"
                
            if source_context:
                full_context += f"Reference sources:\n{source_context}\n\n"
            
            # Create natural, conversational prompt
            rag_prompt = ChatPromptTemplate.from_messages([
                SystemMessage(content="You are a helpful AI assistant. Provide clear, direct answers using the reference information. Write naturally without formal citations."),
                HumanMessage(content=f"""Context information:
{full_context[:2000] if full_context else ''}

Answer this question clearly and naturally: {query}

Provide a comprehensive explanation without formal citations or academic style.""")
            ])
            
            # Stream response using LangChain
            token_count = 0
            start_time = time.time()
            first_token_time = None
            
            async for chunk in self.chat_llm.astream(rag_prompt.format_messages()):
                token = chunk.content
                
                if token and not first_token_time:
                    first_token_time = time.time() - start_time
                    logger.info(f"⚡ First token from LangChain in {first_token_time*1000:.1f}ms")
                
                token_count += 1
                
                # Yield token with metadata
                metadata = None
                if token_count == 1:
                    # Send sources with first token
                    metadata = {
                        "sources": [
                            {
                                "url": p.source_url,
                                "title": p.source_title,
                                "excerpt": p.text[:200] + "...",
                                "relevance_score": p.relevance_score
                            }
                            for p in passages[:6]
                        ]
                    }
                
                yield token, metadata
            
            total_time = time.time() - start_time
            logger.info(f"✅ LangChain generation completed: {token_count} tokens in {total_time:.2f}s")
            
        except Exception as e:
            logger.error(f"❌ LangChain generation failed: {e}")
            yield None, {"error": f"Generation failed: {str(e)}"}
    
    async def generate_simple_response(self, query: str) -> str:
        """Generate simple non-streaming response for testing."""
        try:
            if not self.chat_llm:
                await self.initialize()
            
            response = await self.chat_llm.ainvoke(f"Answer this question concisely: {query}")
            return response.content
            
        except Exception as e:
            logger.error(f"Simple generation failed: {e}")
            return f"Error: {str(e)}"


# Global service instance
_langchain_llm_service: Optional[LangChainLLMService] = None


async def get_langchain_llm_service() -> LangChainLLMService:
    """Get the global LangChain LLM service."""
    global _langchain_llm_service
    if _langchain_llm_service is None:
        _langchain_llm_service = LangChainLLMService()
    return _langchain_llm_service