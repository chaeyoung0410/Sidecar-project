from sqlmodel import Session, select

from app.core.config import get_settings
from app.database.database import engine
from app.models import NotionLog, Project
from app.providers.notion_provider import NotionProvider, NotionProviderError
from app.schemas import NotionLogCreate, NotionLogRead, NotionStatusResponse


class NotionConfigurationError(RuntimeError):
    pass


class NotionService:
    def __init__(self, provider: NotionProvider | None = None) -> None:
        self.provider = provider

    async def status(self) -> NotionStatusResponse:
        settings = get_settings()
        configured = bool(
            settings.notion_api_key.strip()
            and (settings.notion_data_source_id.strip() or settings.notion_database_id.strip())
        )
        if not configured:
            return NotionStatusResponse(
                configured=False,
                connected=False,
                message="Set NOTION_API_KEY and NOTION_DATA_SOURCE_ID (or NOTION_DATABASE_ID)",
            )

        provider = self.provider or self._configured_provider()
        try:
            destination = await provider.destination()
            return NotionStatusResponse(
                configured=True,
                connected=True,
                destination=destination.name,
                data_source_id=destination.data_source_id,
            )
        except NotionProviderError as error:
            return NotionStatusResponse(configured=True, connected=False, message=str(error))
        finally:
            if self.provider is None:
                await provider.close()

    async def create(self, payload: NotionLogCreate) -> NotionLogRead:
        provider = self.provider or self._configured_provider()
        try:
            page, destination = await provider.create_page(payload.title, payload.content, payload.tags)
        finally:
            if self.provider is None:
                await provider.close()

        page_id = page.get("id")
        page_url = page.get("url")
        if not page_id or not page_url:
            raise NotionProviderError("Notion created a page but returned an incomplete response")

        with Session(engine) as session:
            project = session.exec(select(Project).where(Project.is_selected)).first()
            log = NotionLog(
                title=payload.title,
                content=payload.content,
                tags=payload.tags,
                notion_page_id=page_id,
                notion_url=page_url,
                data_source_id=destination.data_source_id,
                project_id=project.id if project else None,
                project_name=project.name if project else None,
            )
            session.add(log)
            session.commit()
            session.refresh(log)
            return NotionLogRead.model_validate(log)

    def recent(self, limit: int = 10) -> list[NotionLogRead]:
        with Session(engine) as session:
            statement = select(NotionLog).order_by(NotionLog.created_at.desc()).limit(limit)
            return [NotionLogRead.model_validate(log) for log in session.exec(statement).all()]

    @staticmethod
    def _configured_provider() -> NotionProvider:
        settings = get_settings()
        if not settings.notion_api_key.strip():
            raise NotionConfigurationError("NOTION_API_KEY is not configured on the Mac Agent")
        if not (settings.notion_data_source_id.strip() or settings.notion_database_id.strip()):
            raise NotionConfigurationError(
                "NOTION_DATA_SOURCE_ID or NOTION_DATABASE_ID is not configured on the Mac Agent"
            )
        return NotionProvider(
            settings.notion_api_key,
            database_id=settings.notion_database_id,
            data_source_id=settings.notion_data_source_id,
            notion_version=settings.notion_version,
        )
