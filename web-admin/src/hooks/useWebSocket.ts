import { useEffect, useRef, useState, useCallback } from 'react';

type ConnectionStatus = 'connecting' | 'connected' | 'closing' | 'disconnected';

export function useWebSocket<TSend = any, TMsg = any>(url: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<TMsg | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    // Check if backend is running first
    fetch('http://localhost:8000/healthz')
      .then(response => {
        if (!response.ok) throw new Error('Backend not running');
        
        try {
          if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) {
            return;
          }

          setConnectionStatus('connecting');
          setError(null);

          ws.current = new WebSocket(url);

          ws.current.onopen = () => {
            setIsConnected(true);
            setConnectionStatus('connected');
            setError(null);
            reconnectAttemptsRef.current = 0;
            console.log('WebSocket connected successfully');
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

          ws.current.onclose = (event) => {
            setIsConnected(false);
            setConnectionStatus('disconnected');
            
            // Only attempt reconnection if it wasn't a clean close
            if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
              const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
              console.log(`WebSocket disconnected, reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
              
              reconnectTimeoutRef.current = setTimeout(() => {
                reconnectAttemptsRef.current++;
                connect();
              }, delay);
            } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
              setError('Failed to connect after multiple attempts. Please check your connection.');
            }
          };

          ws.current.onerror = (event) => {
            console.error('WebSocket error:', event);
            setError('WebSocket connection error');
            setIsConnected(false);
            setConnectionStatus('disconnected');
          };

        } catch (err) {
          console.error('Failed to create WebSocket connection:', err);
          setError('Failed to create WebSocket connection');
          setConnectionStatus('disconnected');
        }
      })
      .catch(() => {
        console.log('Backend not running, skipping WebSocket connection');
        setError('Backend server not running - WebSocket disabled');
        setConnectionStatus('disconnected');
      });
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: TSend) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      try {
        const payload = typeof message === 'string' ? message : JSON.stringify(message);
        ws.current.send(payload);
      } catch (err) {
        console.error('Failed to send WebSocket message:', err);
        setError('Failed to send message');
      }
    } else {
      console.warn('WebSocket is not connected. Cannot send message.');
    }
  }, []);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (ws.current) {
      ws.current.close();
    }
    
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  return {
    isConnected,
    connectionStatus,
    lastMessage,
    error,
    sendMessage,
    reconnect,
  };
}