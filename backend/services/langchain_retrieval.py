"""LangChain-based retrieval service - replaces buggy custom implementation."""

import logging
import time
from typing import List, Optional

from langchain_ollama import OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_core.documents import Document as LCDocument

from models.domain import Document, Passage
from core.exceptions import RetrievalError
from core.config import get_settings

logger = logging.getLogger(__name__)


class LangChainRetrievalService:
    """Production-ready retrieval using LangChain - eliminates infinite loops and hanging."""
    
    def __init__(self):
        self.settings = get_settings()
        self.embeddings = None
        self.text_splitter = None
        self.vectorstore = None
        
        # Configure text splitting (battle-tested, no infinite loops)
        self.chunk_size = 500
        self.chunk_overlap = 50
        self.max_chunks_per_query = 30  # Reasonable limit for performance
        
    async def initialize(self):
        """Initialize LangChain components."""
        try:
            logger.info("Initializing LangChain retrieval service...")
            
            # Initialize Ollama embeddings (proper LangChain integration)
            self.embeddings = OllamaEmbeddings(
                model="nomic-embed-text",
                base_url=self.settings.ollama_base_url
            )
            
            # Initialize text splitter (eliminates infinite loops)
            self.text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=self.chunk_size,
                chunk_overlap=self.chunk_overlap,
                separators=["\n\n", "\n", " ", ""]  # Smart separators
            )
            
            # Test embeddings to ensure Ollama is working
            test_start = time.time()
            test_vector = self.embeddings.embed_query("test")
            test_time = time.time() - test_start
            
            if test_vector and len(test_vector) > 0:
                logger.info(f"LangChain embeddings ready: {len(test_vector)} dims in {test_time*1000:.1f}ms")
                return True
            else:
                logger.error("LangChain embeddings test failed")
                return False
                
        except Exception as e:
            logger.error(f"LangChain retrieval initialization failed: {e}")
            return False
    
    async def retrieve_passages(
        self, 
        query: str, 
        documents: List[Document], 
        max_passages: int = 6
    ) -> List[Passage]:
        """Retrieve passages using LangChain - guaranteed no infinite loops."""
        try:
            start_time = time.time()
            
            if not self.embeddings or not self.text_splitter:
                success = await self.initialize()
                if not success:
                    raise RetrievalError("LangChain retrieval initialization failed")
            
            logger.info(f"📄 Processing {len(documents)} documents with LangChain...")
            
            # Convert to LangChain documents and split
            all_splits = []
            
            for i, doc in enumerate(documents):
                logger.debug(f"Processing document {i+1}: {doc.title[:50]}... ({len(doc.content)} chars)")
                
                # Create LangChain document
                lc_doc = LCDocument(
                    page_content=doc.content,
                    metadata={
                        "source_url": doc.url,
                        "source_title": doc.title,
                        "excerpt": doc.excerpt
                    }
                )
                
                # Split with LangChain (guaranteed no infinite loops)
                doc_splits = self.text_splitter.split_documents([lc_doc])
                
                # Limit splits per document for performance
                if len(doc_splits) > 10:
                    doc_splits = doc_splits[:10]
                    logger.debug(f"Limited document {i+1} to 10 splits")
                
                all_splits.extend(doc_splits)
                logger.debug(f"Document {i+1} split into {len(doc_splits)} chunks")
            
            # Limit total chunks for performance
            if len(all_splits) > self.max_chunks_per_query:
                all_splits = all_splits[:self.max_chunks_per_query]
                logger.info(f"⚡ Limited to {self.max_chunks_per_query} chunks for performance")
            
            logger.info(f"Split into {len(all_splits)} total chunks")
            
            if not all_splits:
                logger.warning("No chunks created from documents")
                return []
            
            # Create vector store with LangChain (handles batch embeddings)
            chunk_texts = [split.page_content for split in all_splits]
            
            logger.info(f"Creating vector store with {len(chunk_texts)} chunks...")
            vector_start = time.time()
            
            self.vectorstore = InMemoryVectorStore.from_texts(
                chunk_texts,
                embedding=self.embeddings,
                metadatas=[split.metadata for split in all_splits]
            )
            
            vector_time = time.time() - vector_start
            logger.info(f"Vector store created in {vector_time:.2f}s")
            
            # Retrieve most relevant passages
            retrieval_start = time.time()
            relevant_docs = self.vectorstore.similarity_search_with_score(query, k=max_passages)
            retrieval_time = time.time() - retrieval_start
            
            logger.info(f"Retrieved {len(relevant_docs)} passages in {retrieval_time*1000:.1f}ms")
            
            # Convert back to our Passage format
            passages = []
            for doc, score in relevant_docs:
                passages.append(Passage(
                    text=doc.page_content,
                    source_url=doc.metadata.get("source_url", ""),
                    source_title=doc.metadata.get("source_title", ""),
                    relevance_score=float(score)
                ))
            
            total_time = time.time() - start_time
            logger.info(f"LangChain retrieval completed in {total_time:.2f}s")
            
            return passages
            
        except Exception as e:
            logger.error(f"LangChain retrieval failed: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise RetrievalError(f"LangChain retrieval failed: {str(e)}")
    
    async def cleanup(self):
        """Cleanup resources."""
        try:
            self.vectorstore = None
            # LangChain handles cleanup automatically
            logger.info("LangChain retrieval cleaned up")
        except Exception as e:
            logger.warning(f"Cleanup error: {e}")


# Global service instance
_langchain_retrieval_service: Optional[LangChainRetrievalService] = None


async def get_langchain_retrieval_service() -> LangChainRetrievalService:
    """Get the global LangChain retrieval service."""
    global _langchain_retrieval_service
    if _langchain_retrieval_service is None:
        _langchain_retrieval_service = LangChainRetrievalService()
    return _langchain_retrieval_service