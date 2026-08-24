from fastapi import APIRouter, HTTPException, Query, status

from app.providers.notion_provider import NotionProviderError
from app.schemas import NotionLogCreate, NotionLogRead, NotionStatusResponse
from app.services.notion_service import NotionConfigurationError, NotionService


router = APIRouter(prefix="/api/notion", tags=["notion"])


@router.get("/status", response_model=NotionStatusResponse)
async def get_notion_status() -> NotionStatusResponse:
    return await NotionService().status()


@router.get("/logs", response_model=list[NotionLogRead])
def list_notion_logs(limit: int = Query(default=10, ge=1, le=50)) -> list[NotionLogRead]:
    return NotionService().recent(limit)


@router.post("/logs", response_model=NotionLogRead, status_code=status.HTTP_201_CREATED)
async def create_notion_log(payload: NotionLogCreate) -> NotionLogRead:
    try:
        return await NotionService().create(payload)
    except NotionConfigurationError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except NotionProviderError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error
