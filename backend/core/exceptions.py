"""Custom exceptions and error handling."""

from typing import Dict, Any, Optional
from fastapi import HTTPException, status


class ServiceError(Exception):
    """Base service error."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.details = details or {}
        super().__init__(message)


class SearchError(ServiceError):
    """Search service error."""
    pass


class RetrievalError(ServiceError):
    """Retrieval service error."""
    pass


class LLMError(ServiceError):
    """LLM service error."""
    pass


class CVAError(ServiceError):
    """CVA service error."""
    pass


class DatabaseError(ServiceError):
    """Database operation error."""
    pass


def create_http_exception(
    status_code: int,
    error_code: str,
    message: str,
    details: Optional[Dict[str, Any]] = None
) -> HTTPException:
    """Create standardized HTTP exception."""
    return HTTPException(
        status_code=status_code,
        detail={
            "error": {
                "code": error_code,
                "message": message,
                "details": details or {}
            }
        }
    )


# Common exceptions
def not_found_exception(resource: str, resource_id: str) -> HTTPException:
    """Create not found exception."""
    return create_http_exception(
        status.HTTP_404_NOT_FOUND,
        "RESOURCE_NOT_FOUND",
        f"{resource} not found",
        {"resource_id": resource_id}
    )


def validation_exception(message: str, details: Dict[str, Any] = None) -> HTTPException:
    """Create validation exception."""
    return create_http_exception(
        status.HTTP_400_BAD_REQUEST,
        "VALIDATION_ERROR",
        message,
        details
    )


def internal_server_exception(message: str = "Internal server error") -> HTTPException:
    """Create internal server exception."""
    return create_http_exception(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "INTERNAL_SERVER_ERROR",
        message
    )