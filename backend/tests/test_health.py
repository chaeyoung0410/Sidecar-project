from fastapi.testclient import TestClient

from app.main import app


def test_health_check() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "CodePad Agent",
        "version": "0.10.0",
    }


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
