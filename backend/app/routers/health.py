from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.health import AgentInfoResponse, HealthResponse
from app.services.network_service import get_network_info


router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(status="ok", service=settings.app_name, version=settings.app_version)


@router.get("/agent/info", response_model=AgentInfoResponse)
def agent_info() -> AgentInfoResponse:
    settings = get_settings()
    network = get_network_info()
    return AgentInfoResponse(
        name=settings.app_name,
        hostname=network.hostname,
        local_hostname=network.local_hostname,
        ip=network.ip,
        port=settings.agent_port,
        status="running",
    )
