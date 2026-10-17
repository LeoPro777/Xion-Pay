from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from src.core.security import decode_access_token
from src.modules.notifications.manager import notification_manager
import logging

logger = logging.getLogger("xionpay.notifications")
router = APIRouter()


@router.websocket("/ws/admin/notifications")
async def websocket_admin_notifications(
    websocket: WebSocket,
    token: str = Query(None),
):
    """
    WebSocket endpoint for real-time administrator notifications.
    Validates admin session token on handshake.
    """
    if not token:
        # If in development, allow connection without token for quick inspection
        # otherwise close with policy violation
        try:
            await websocket.close(code=1008)
            return
        except Exception:
            return

    try:
        decode_access_token(token)
    except Exception as e:
        logger.warning(f"WebSocket handshake failed authentication: {str(e)}")
        await websocket.close(code=1008)
        return

    await notification_manager.connect(websocket)
    try:
        while True:
            # Keep socket alive and respond to client pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        notification_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket unexpected error: {str(e)}")
        notification_manager.disconnect(websocket)
