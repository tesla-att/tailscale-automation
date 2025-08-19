from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List
import json
import asyncio
from datetime import datetime

class NotificationManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_subscriptions: Dict[str, List[str]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        print(f"User {user_id} connected")

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.user_subscriptions:
            del self.user_subscriptions[user_id]
        print(f"User {user_id} disconnected")

    async def send_notification(self, user_id: str, notification: dict):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_text(
                    json.dumps({
                        **notification,
                        "timestamp": datetime.now().isoformat()
                    })
                )
            except:
                self.disconnect(user_id)

    async def broadcast_notification(self, notification: dict):
        disconnected = []
        for user_id, websocket in self.active_connections.items():
            try:
                await websocket.send_text(
                    json.dumps({
                        **notification,
                        "timestamp": datetime.now().isoformat()
                    })
                )
            except:
                disconnected.append(user_id)
        
        for user_id in disconnected:
            self.disconnect(user_id)

notification_manager = NotificationManager()