import { useEffect, useRef, useState } from 'react';
import { notification } from 'antd';

interface Notification {
  type: string;
  message: string;
  data?: any;
  timestamp: string;
}

export const useWebSocket = (userId: string) => {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      const wsUrl = `ws://localhost:8000/ws/${userId}`;
      ws.current = new WebSocket(wsUrl);
      setConnectionStatus('connecting');

      ws.current.onopen = () => {
        setConnectionStatus('connected');
        notification.success({
          message: 'Connected',
          description: 'Real-time notifications enabled',
          duration: 2
        });
      };

      ws.current.onmessage = (event) => {
        const data: Notification = JSON.parse(event.data);
        setNotifications(prev => [data, ...prev.slice(0, 49)]); // Keep last 50

        // Show notification to user
        notification.info({
          message: data.type.replace('_', ' ').toUpperCase(),
          description: data.message,
          duration: 4
        });
      };

      ws.current.onclose = () => {
        setConnectionStatus('disconnected');
        // Auto reconnect after 3 seconds
        setTimeout(connect, 3000);
      };

      ws.current.onerror = () => {
        setConnectionStatus('disconnected');
      };
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [userId]);

  return { connectionStatus, notifications };
};