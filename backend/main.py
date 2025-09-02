"""
Per-Flex-ity Backend

AI-powered search and chat backend with vector retrieval and claim verification.

Features:
- FastAPI with SQLite database
- Hybrid web search (DDGS + SerpAPI fallback)
- Vector-based document retrieval
- Streaming responses with source citations
- Background claim verification analysis
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import get_settings
from core.database import init_database, close_database, health_check
from routes.chat import router as chat_router
from routes.conversations import router as conversations_router
from services.coordinator import get_orchestrator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    settings = get_settings()
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    
    # Initialize database
    try:
        await init_database()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise
    
    # Initialize services
    try:
        orchestrator = get_orchestrator()
        
        # Run basic health check
        health_status = await orchestrator.health_check()
        
        if not health_status.get("overall", False):
            logger.warning("Some services may not be fully operational")
            logger.info(f"Service health: {health_status}")
        else:
            logger.info("All services operational and ready")
    except Exception as e:
        logger.error(f"Service initialization failed: {e}")
        # Don't raise - allow app to start even if some services are unavailable
    
    logger.info("Application startup completed")
    
    yield
    
    # Shutdown
    logger.info("Shutting down application")
    await close_database()
    logger.info("Application shutdown completed")


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    settings = get_settings()
    
    # Create FastAPI app
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Simplified AI-powered search and chat with optional CVA",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        allow_credentials=True
    )
    
    # Add routers with /api prefix for clean endpoints
    app.include_router(chat_router, prefix="/api")
    app.include_router(conversations_router, prefix="/api")
    
    # Root endpoint
    @app.get("/", tags=["Root"])
    async def root():
        """Root endpoint."""
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "description": "Simplified AI search and chat backend",
            "docs_url": "/docs" if settings.debug else "Documentation disabled in production"
        }
    

    # Health check endpoint
    @app.get("/health", tags=["Health"])
    async def health():
        """Health check endpoint."""
        try:
            # Check database
            db_healthy = await health_check()
            
            # Check services
            orchestrator = get_orchestrator()
            service_health = await orchestrator.health_check()
            
            overall_healthy = db_healthy and service_health.get("overall", False)
            
            status_data = {
                "status": "healthy" if overall_healthy else "degraded",
                "database": "connected" if db_healthy else "disconnected",
                "services": service_health,
                "version": settings.app_version
            }
            
            status_code = 200 if overall_healthy else 503
            return JSONResponse(content=status_data, status_code=status_code)
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return JSONResponse(
                content={
                    "status": "unhealthy",
                    "error": str(e),
                    "version": settings.app_version
                },
                status_code=503
            )
    
    # Global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """Global exception handler for unhandled errors."""
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred",
                    "detail": str(exc) if settings.debug else None
                }
            }
        )
    
    # 404 handler
    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc):
        """Handle 404 errors."""
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "NOT_FOUND",
                    "message": "The requested resource was not found",
                    "path": request.url.path
                }
            }
        )
    
    logger.info(f"FastAPI application created: {settings.app_name}")
    logger.info("Available endpoints:")
    logger.info("  POST /api/ask - Ask questions with CVA enabled by default")
    logger.info("  GET  /api/conversations - List conversations")
    logger.info("  GET  /health - Health check")
    
    return app


# Create application instance
app = create_app()


if __name__ == "__main__":
    import uvicorn
    
    settings = get_settings()
    
    logger.info(f"Starting server at http://{settings.host}:{settings.port}")
    logger.info("Key features:")
    logger.info("  • Simplified architecture (12 files vs 50+)")
    logger.info("  • In-memory vector retrieval with caching")
    logger.info("  • Optional Claim-Verified Answering (CVA)")
    logger.info("  • Parallel pipeline execution")
    logger.info("  • Professional error handling")
    logger.info("  • SQLite database with proper initialization")
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info"
    )