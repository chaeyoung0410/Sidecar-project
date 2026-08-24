from fastapi import APIRouter, HTTPException, status

from app.providers.gemini_provider import AIProviderError
from app.schemas import (
    AIAnalysisRead,
    AIAnalyzeRequest,
    AIStatusResponse,
    AIJournalGenerateRequest,
    AIJournalRead,
    DevelopmentJournalContext,
    ErrorAnalysisContext,
)
from app.services import AIService
from app.services.ai_service import AIConfigurationError, AIErrorNotFoundError, AIServiceError


router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get("/status", response_model=AIStatusResponse)
def get_ai_status() -> AIStatusResponse:
    configured, model = AIService().status()
    return AIStatusResponse(configured=configured, model=model)


@router.get("/journal/context", response_model=DevelopmentJournalContext)
def get_journal_context() -> DevelopmentJournalContext:
    try:
        return AIService().journal_context()
    except AIServiceError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.post("/journal/generate", response_model=AIJournalRead)
async def generate_journal(_: AIJournalGenerateRequest) -> AIJournalRead:
    try:
        return await AIService().generate_journal()
    except AIConfigurationError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except AIServiceError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except AIProviderError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error


@router.get("/errors/{error_id}/context", response_model=ErrorAnalysisContext)
def get_analysis_context(error_id: int) -> ErrorAnalysisContext:
    try:
        return AIService().context(error_id)
    except AIErrorNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except AIServiceError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.get("/errors/{error_id}/analysis", response_model=AIAnalysisRead | None)
def get_latest_analysis(error_id: int) -> AIAnalysisRead | None:
    try:
        return AIService().latest(error_id)
    except AIErrorNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post("/errors/{error_id}/analyze", response_model=AIAnalysisRead)
async def analyze_error(error_id: int, _: AIAnalyzeRequest) -> AIAnalysisRead:
    try:
        return await AIService().analyze(error_id)
    except AIErrorNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except AIConfigurationError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except (AIServiceError, AIProviderError) as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error
