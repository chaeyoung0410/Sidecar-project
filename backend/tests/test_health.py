from fastapi.testclient import TestClient

from app.main import app
from app.routers import health
from app.services.network_service import NetworkInfo


def test_health_check() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "CodePad Agent",
        "version": "0.10.0",
    }


def test_agent_info(monkeypatch) -> None:
    monkeypatch.setattr(
        health,
        "get_network_info",
        lambda: NetworkInfo(
            hostname="chae-young-macbook",
            local_hostname="chae-young-macbook.local",
            ip="192.168.45.7",
        ),
    )

    with TestClient(app) as client:
        response = client.get("/api/agent/info")

    assert response.status_code == 200
    assert response.json() == {
        "name": "CodePad Agent",
        "hostname": "chae-young-macbook",
        "local_hostname": "chae-young-macbook.local",
        "ip": "192.168.45.7",
        "port": 8000,
        "status": "running",
    }


def test_local_network_cors_origin_is_allowed() -> None:
    with TestClient(app) as client:
        response = client.options(
            "/api/health",
            headers={
                "Origin": "http://chae-young-macbook.local:5173",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://chae-young-macbook.local:5173"


def test_public_cors_origin_is_not_allowed() -> None:
    with TestClient(app) as client:
        response = client.options(
            "/api/health",
            headers={
                "Origin": "https://example.com",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_websocket_connects_and_responds_to_heartbeat() -> None:
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            connected_event = websocket.receive_json()
            assert connected_event["type"] == "agent.connected"
            assert connected_event["data"] == {
                "service": "CodePad Agent",
                "version": "0.10.0",
            }
            assert connected_event["timestamp"]

            websocket.send_json({"type": "ping"})
            pong_event = websocket.receive_json()
            assert pong_event["type"] == "pong"
            assert pong_event["timestamp"]
