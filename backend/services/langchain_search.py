"""Complete LangChain search service using async DDGS + AsyncHtmlLoader."""

import asyncio
import logging
import time
from typing import List, Optional
from datetime import datetime, timezone

from langchain_community.tools import DuckDuckGoSearchResults
from langchain_community.document_loaders import AsyncHtmlLoader
from langchain_community.utilities import DuckDuckGoSearchAPIWrapper

from models.domain import SearchResult, Document
from core.exceptions import SearchError
from core.config import get_settings

logger = logging.getLogger(__name__)


class LangChainSearchService:
    """Production-grade search using LangChain DDGS + AsyncHtmlLoader."""
    
    def __init__(self):
        self.settings = get_settings()
        
        # Configure LangChain DDGS wrapper for optimal results
        self.ddgs_wrapper = DuckDuckGoSearchAPIWrapper(
            region="en-us",
            safesearch="moderate",
            time="y",  # Past year for fresh content
            max_results=10
        )
        
        # Initialize LangChain DDGS search with list output
        self.ddgs_search = DuckDuckGoSearchResults(
            api_wrapper=self.ddgs_wrapper,
            output_format="list"  # Returns structured list
        )
        
        # Performance tracking
        self.search_stats = {
            'ddgs_success': 0,
            'ddgs_failures': 0,
            'extraction_success': 0,
            'extraction_failures': 0
        }
    
    async def search_and_fetch(self, query: str, max_results: int = 5) -> List[Document]:
        """Complete async search and fetch using LangChain components."""
        try:
            start_time = time.time()
            logger.info(f"🦜 LangChain DDGS search: {query[:50]}...")
            
            # Step 1: Async DDGS search using LangChain
            search_results = await self.ddgs_search.ainvoke(query)
            
            if not search_results:
                logger.warning("No DDGS results found")
                self.search_stats['ddgs_failures'] += 1
                return []
            
            self.search_stats['ddgs_success'] += 1
            logger.info(f"✅ DDGS found {len(search_results)} results")
            
            # Step 2: Extract URLs and metadata
            urls = []
            url_metadata = {}
            
            for i, result in enumerate(search_results[:max_results]):
                url = result.get('link', '')
                if url and url.startswith('http'):
                    urls.append(url)
                    url_metadata[url] = {
                        'title': result.get('title', f'Document {i+1}'),
                        'snippet': result.get('snippet', ''),
                        'rank': i + 1,
                        'source': 'ddgs'
                    }
            
            logger.info(f"📡 Extracted {len(urls)} valid URLs")
            
            # Step 3: LangChain AsyncHtmlLoader for content extraction
            if urls:
                documents = await self._extract_content_with_langchain(urls, url_metadata, query)
                
                search_time = time.time() - start_time
                
                if documents:
                    self.search_stats['extraction_success'] += 1
                    success_rate = len(documents) / len(urls) * 100
                    logger.info(f"✅ LangChain pipeline: {len(documents)}/{len(urls)} docs ({success_rate:.1f}%) in {search_time:.2f}s")
                else:
                    self.search_stats['extraction_failures'] += 1
                    logger.warning("❌ No content extracted")
                
                return documents
            else:
                logger.warning("No valid URLs to fetch")
                return []
                
        except Exception as e:
            logger.error(f"❌ LangChain search pipeline failed: {e}")
            self.search_stats['ddgs_failures'] += 1
            raise SearchError(f"LangChain search failed: {str(e)}")
    
    async def _extract_content_with_langchain(
        self, 
        urls: List[str], 
        url_metadata: dict, 
        query: str
    ) -> List[Document]:
        """Extract content using hybrid approach - LangChain + improved cleaning."""
        try:
            logger.info(f"🦜 Hybrid content extraction: {len(urls)} URLs")
            
            # Use LangChain AsyncHtmlLoader but with better cleaning
            loader = AsyncHtmlLoader(urls)
            
            start_time = time.time()
            langchain_docs = await loader.aload()
            extraction_time = time.time() - start_time
            
            logger.info(f"✅ Raw content extracted: {len(langchain_docs)} docs in {extraction_time:.2f}s")
            
            # Clean and process documents with our superior cleaning logic
            documents = []
            
            for lc_doc in langchain_docs:
                try:
                    url = lc_doc.metadata.get('source', '')
                    metadata = url_metadata.get(url, {})
                    raw_content = lc_doc.page_content
                    
                    # Apply superior content cleaning (from our original system)
                    clean_content = self._clean_html_content(raw_content)
                    
                    if len(clean_content) > 200:  # Keep substantial content
                        # Limit content size for performance
                        if len(clean_content) > 5000:
                            clean_content = clean_content[:5000] + "..."
                        
                        documents.append(Document(
                            url=url,
                            title=metadata.get('title', 'Document'),
                            content=clean_content,
                            excerpt=metadata.get('snippet', clean_content[:200] + "..."),
                            fetched_at=datetime.now(timezone.utc),
                            metadata={
                                'source': metadata.get('source', 'ddgs'),
                                'query': query,
                                'rank': metadata.get('rank', 0)
                            }
                        ))
                        
                        logger.debug(f"✅ Cleaned: {metadata.get('title', 'Unknown')[:40]}... ({len(clean_content)} chars)")
                    else:
                        logger.debug(f"⏭️ Skipped short content: {len(clean_content)} chars")
                        
                except Exception as e:
                    logger.warning(f"❌ Document processing failed: {e}")
                    continue
            
            logger.info(f"📊 Final result: {len(documents)} cleaned documents")
            return documents
            
        except Exception as e:
            logger.error(f"❌ Content extraction failed: {e}")
            return []
    
    def _clean_html_content(self, raw_content: str) -> str:
        """Clean HTML content using our superior cleaning logic."""
        try:
            from bs4 import BeautifulSoup
            
            # If content looks like HTML, parse it
            if '<' in raw_content and '>' in raw_content:
                soup = BeautifulSoup(raw_content, 'html.parser')
                
                # Remove unwanted elements
                for element in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'meta', 'link']):
                    element.decompose()
                
                # Get text from relevant elements
                text = soup.get_text()
                lines = (line.strip() for line in text.splitlines())
                clean_text = ' '.join(line for line in lines if line)
            else:
                # Already clean text
                clean_text = raw_content
            
            # Additional cleaning
            clean_text = clean_text.replace('\r', ' ').replace('\n', ' ')
            while '  ' in clean_text:
                clean_text = clean_text.replace('  ', ' ')
            
            return clean_text.strip()
            
        except Exception as e:
            logger.warning(f"Content cleaning failed: {e}")
            return raw_content[:1000]  # Fallback to truncated raw content
    
    async def get_search_stats(self) -> dict:
        """Get comprehensive search statistics."""
        total_ddgs = self.search_stats['ddgs_success'] + self.search_stats['ddgs_failures']
        total_extraction = self.search_stats['extraction_success'] + self.search_stats['extraction_failures']
        
        return {
            'ddgs': {
                'success': self.search_stats['ddgs_success'],
                'failures': self.search_stats['ddgs_failures'],
                'success_rate': (self.search_stats['ddgs_success'] / total_ddgs * 100) if total_ddgs > 0 else 0
            },
            'extraction': {
                'success': self.search_stats['extraction_success'],
                'failures': self.search_stats['extraction_failures'],
                'success_rate': (self.search_stats['extraction_success'] / total_extraction * 100) if total_extraction > 0 else 0
            },
            'config': {
                'langchain_powered': True,
                'ddgs_enabled': True,
                'async_html_loader': True
            }
        }


# Global service instance
_langchain_search_service: Optional[LangChainSearchService] = None


async def get_langchain_search_service() -> LangChainSearchService:
    """Get the global LangChain search service."""
    global _langchain_search_service
    if _langchain_search_service is None:
        _langchain_search_service = LangChainSearchService()
    return _langchain_search_service