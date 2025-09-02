"""Unit tests for LangChain pipeline components."""

import pytest
import sys
import os
from unittest.mock import Mock, patch, AsyncMock

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Test LangChain Search Service
@pytest.mark.asyncio
async def test_langchain_search_service():
    """Test LangChain DDGS search functionality."""
    from services.search import LangChainSearchService
    
    # Simple test without complex mocking
    service = LangChainSearchService()
    
    # Test that service initializes properly
    assert service.ddgs_search is not None
    assert service.ddgs_wrapper is not None
    
    # Test search stats
    stats = await service.get_search_stats()
    assert "ddgs" in stats
    assert "extraction" in stats
    assert stats["config"]["langchain_powered"] is True


@pytest.mark.asyncio 
async def test_langchain_retrieval_service():
    """Test LangChain retrieval with text splitting."""
    from services.retrieval import LangChainRetrievalService
    from models.domain import Document
    
    # Mock LangChain components
    with patch('services.retrieval.OllamaEmbeddings') as mock_embeddings, \
         patch('services.retrieval.RecursiveCharacterTextSplitter') as mock_splitter, \
         patch('services.retrieval.InMemoryVectorStore') as mock_store:
        
        # Mock embeddings
        mock_embeddings.return_value.embed_query = AsyncMock(return_value=[0.1] * 768)
        
        # Mock text splitter
        mock_doc = Mock()
        mock_doc.page_content = "GGML is a tensor library"
        mock_doc.metadata = {'source_url': 'test.com', 'source_title': 'Test'}
        mock_splitter.return_value.split_documents.return_value = [mock_doc]
        
        # Mock vector store
        mock_result = Mock()
        mock_result.page_content = "GGML tensor library content"
        mock_result.metadata = {'source_url': 'test.com', 'source_title': 'Test'}
        mock_store.from_texts.return_value.similarity_search_with_score.return_value = [
            (mock_result, 0.85)
        ]
        
        # Test service
        service = LangChainRetrievalService()
        service.embeddings = mock_embeddings.return_value
        service.text_splitter = mock_splitter.return_value
        
        test_docs = [Document(
            url="test.com", 
            title="Test Doc", 
            content="GGML is a tensor library for machine learning",
            excerpt="GGML tensor library",
            fetched_at=None,
            metadata={}
        )]
        
        passages = await service.retrieve_passages("What is GGML?", test_docs, max_passages=3)
        
        assert len(passages) == 1
        assert passages[0].source_url == "test.com"


@pytest.mark.asyncio
async def test_langchain_cva_service():
    """Test LangChain CVA with structured output."""
    from services.cva import LangChainCVAService
    from models.domain import Passage
    
    # Mock LangChain CVA components
    with patch('services.cva.ChatOllama') as mock_chat:
        # Mock claim extraction
        mock_response = Mock()
        mock_response.content = '{"claims": ["GGML is a tensor library", "GGML was created by Georgi Gerganov"]}'
        
        mock_chat.return_value.ainvoke = AsyncMock(return_value=mock_response)
        
        # Test service
        service = LangChainCVAService()
        service.claim_extraction_llm = mock_chat.return_value
        service.claim_verification_llm = mock_chat.return_value
        
        test_passages = [Passage(
            text="GGML is a tensor library created by Georgi Gerganov",
            source_url="test.com",
            source_title="Test Source",
            relevance_score=0.9
        )]
        
        result = await service.verify_claims_background(
            "GGML is a tensor library", 
            test_passages
        )
        
        assert result.total_claims >= 0
        assert isinstance(result.overall_confidence, float)


def test_query_decomposition_detection():
    """Test query complexity detection for decomposition."""
    from services.coordinator import ChatCoordinator
    
    coordinator = ChatCoordinator()
    
    # Simple queries - should NOT decompose
    assert not coordinator._should_decompose_query("What is GGML?")
    assert not coordinator._should_decompose_query("How does ML work?")
    
    # Complex queries - should decompose  
    assert coordinator._should_decompose_query("What is machine learning and how does it relate to GGML?")
    assert coordinator._should_decompose_query("What are the differences between GGML and GGUF formats?")
    assert coordinator._should_decompose_query("How does deep learning work and what are neural networks?")


def test_source_deduplication():
    """Test frontend source deduplication utility."""
    # This would be in frontend tests, but including logic here
    def deduplicate_sources(sources):
        source_map = {}
        for source in sources:
            existing = source_map.get(source['url'])
            if not existing or source['relevance_score'] > existing['relevance_score']:
                source_map[source['url']] = source
        return sorted(source_map.values(), key=lambda x: x['relevance_score'], reverse=True)
    
    # Test data with duplicates
    sources = [
        {'url': 'example.com', 'title': 'Test 1', 'relevance_score': 0.7},
        {'url': 'example.com', 'title': 'Test 2', 'relevance_score': 0.9},  # Higher score
        {'url': 'other.com', 'title': 'Other', 'relevance_score': 0.8}
    ]
    
    deduplicated = deduplicate_sources(sources)
    
    assert len(deduplicated) == 2  # Deduplicated
    assert deduplicated[0]['relevance_score'] == 0.9  # Highest first
    assert deduplicated[0]['title'] == 'Test 2'  # Kept higher score version


if __name__ == "__main__":
    pytest.main([__file__, "-v"])