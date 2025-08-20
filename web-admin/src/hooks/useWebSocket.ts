import { useEffect, useRef, useState } from 'react';

type ConnectionStatus = 'connecting' | 'connected' | 'closing' | 'disconnected';

export function useWebSocket<TSend = any, TMsg = any>(url: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [lastMessage, setLastMessage] = useState<TMsg | null>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Ensure a proper ws:// or wss:// URL is passed in
    ws.current = new WebSocket(url);
    setConnectionStatus('connecting');

    ws.current.onopen = () => {
      setIsConnected(true);
      setConnectionStatus('connected');
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data as TMsg);
      } catch {
        // Fallback to raw data if it isn't JSON
        setLastMessage(event.data as TMsg);
      }
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
    };

    ws.current.onerror = () => {
      // error usually followed by close; mark disconnected
      setIsConnected(false);
      setConnectionStatus('disconnected');
    };

    return () => {
      // If we're open/connecting, initiate a clean close
      if (ws.current && ws.current.readyState === WebSocket.OPEN) ws.current.close();
      ws.current = null;
    };
  }, [url]);

  const sendMessage = (message: TSend) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      ws.current.send(payload);
    }
  };

  const isConnecting = connectionStatus === 'connecting';

  return { isConnected, isConnecting, connectionStatus, lastMessage, sendMessage };
}