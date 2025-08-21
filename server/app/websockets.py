from fastapi import WebSocket, WebSocketDisconnect
from typing import List
import json
import asyncio
from datetime import datetime

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except:
                await self.disconnect(connection)
    
    async def broadcast_notification(self, message: dict):
        """Alias for broadcast method to maintain compatibility"""
        await self.broadcast(message)

notification_manager = ConnectionManager()

async def websocket_endpoint(websocket: WebSocket):
    try:
        await notification_manager.connect(websocket)
        print(f"WebSocket connected: {websocket.client}")
        
        while True:
            try:
                # Send periodic heartbeat
                await notification_manager.send_personal_message(
                    json.dumps({"type": "heartbeat", "timestamp": datetime.now().isoformat()}), 
                    websocket
                )
                await asyncio.sleep(30)  # Heartbeat every 30 seconds
            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"WebSocket error: {e}")
                break
                
    except WebSocketDisconnect:
        print(f"WebSocket disconnected: {websocket.client}")
        notification_manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket connection error: {e}")
        try:
            notification_manager.disconnect(websocket)
        except:
            pass