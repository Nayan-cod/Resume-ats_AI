import { useEffect, useRef, useCallback } from 'react';
import { WS_URL } from '../lib/config';

/**
 * Custom hook for WebSocket real-time updates.
 * Connects to the backend WebSocket and calls onMessage when a notification arrives.
 * Automatically reconnects on disconnect.
 */
export function useWebSocket(onMessage) {
    const wsRef = useRef(null);
    const reconnectTimer = useRef(null);

    const connect = useCallback(() => {
        try {
            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[WS] Connected to server');
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('[WS] Received:', data);
                    if (onMessage) onMessage(data);
                } catch (e) {
                    console.error('[WS] Parse error:', e);
                }
            };

            ws.onclose = () => {
                console.log('[WS] Disconnected. Reconnecting in 3s...');
                reconnectTimer.current = setTimeout(connect, 3000);
            };

            ws.onerror = (err) => {
                console.error('[WS] Error:', err);
                ws.close();
            };
        } catch (e) {
            console.error('[WS] Connection failed:', e);
            reconnectTimer.current = setTimeout(connect, 3000);
        }
    }, [onMessage]);

    useEffect(() => {
        connect();

        // Send periodic pings to keep connection alive
        const pingInterval = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send('ping');
            }
        }, 30000);

        return () => {
            clearInterval(pingInterval);
            clearTimeout(reconnectTimer.current);
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect]);

    return wsRef;
}
