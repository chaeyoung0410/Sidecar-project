from datetime import UTC, datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config import get_settings
from app.services import connection_manager


router = APIRouter(tags=["websocket"])


def timestamp() -> str:
    return datetime.now(UTC).isoformat()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    settings = get_settings()
    await connection_manager.connect(websocket)

    try:
        await connection_manager.send(
            websocket,
            {
                "type": "agent.connected",
                "timestamp": timestamp(),
                "data": {
                    "service": settings.app_name,
                    "version": settings.app_version,
                },
            },
        )

        while True:
            message = await websocket.receive_json()
            if message.get("type") == "ping":
                await connection_manager.send(
                    websocket,
                    {"type": "pong", "timestamp": timestamp()},
                )
    except WebSocketDisconnect:
        connection_manager.disconnect(websocket)
    except (RuntimeError, ValueError):
        connection_manager.disconnect(websocket)
        await websocket.close(code=1003)
