import json
import logging
from typing import Any, Dict, List
from fastapi import WebSocket

logger = logging.getLogger("xionpay.notifications")


class NotificationManager:
    """Manages active WebSocket connections for admin live notifications."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total active: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast payload to all connected admin sockets."""
        if not self.active_connections:
            return

        payload = json.dumps(message)
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception as e:
                logger.error(f"Error sending message to WebSocket client: {str(e)}")
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)


notification_manager = NotificationManager()
