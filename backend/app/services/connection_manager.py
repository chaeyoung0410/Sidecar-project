from fastapi import WebSocket


class ConnectionManager:
    """Track dashboard clients and provide a shared real-time event channel."""

    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    @property
    def active_count(self) -> int:
        return len(self._connections)

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def send(self, websocket: WebSocket, event: dict[str, object]) -> None:
        await websocket.send_json(event)

    async def broadcast(self, event: dict[str, object]) -> None:
        stale_connections: list[WebSocket] = []

        for connection in tuple(self._connections):
            try:
                await connection.send_json(event)
            except Exception:
                stale_connections.append(connection)

        for connection in stale_connections:
            self.disconnect(connection)


connection_manager = ConnectionManager()
