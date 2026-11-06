import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';

export interface NotificationItem {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  data?: any;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  clearNotifications: () => void;
  lastEventTimestamp: number;
  addNotification: (item: { type: string; message: string; data?: any }) => void;
  wsConnected: boolean;
  subscribeToSocket: (cb: (msg: any) => void) => () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [lastEventTimestamp, setLastEventTimestamp] = useState<number>(Date.now());
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const listenersRef = useRef<Set<(msg: any) => void>>(new Set());

  const subscribeToSocket = (cb: (msg: any) => void) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  };

  const addNotification = (item: { type: string; message: string; data?: any }) => {
    const newItem: NotificationItem = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: item.type,
      message: item.message,
      timestamp: new Date().toLocaleTimeString(),
      data: item.data,
    };
    setNotifications((prev) => [newItem, ...prev]);
    setUnreadCount((c) => c + 1);
    setLastEventTimestamp(Date.now());
  };

  useEffect(() => {
    if (!token) {
      setWsConnected(false);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // In dev Vite proxy forwards /ws to backend ws://localhost:8000
    const wsUrl = `${protocol}//${host}/ws/admin/notifications?token=${token}`;

    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let pingInterval: any = null;

    const connect = () => {
      try {
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          console.log('[WebSocket] Conectado a canal de notificaciones administrativas WSS');
          setWsConnected(true);
          // Heartbeat keep-alive every 20 seconds
          pingInterval = setInterval(() => {
            if (socket && socket.readyState === WebSocket.OPEN) {
              socket.send('ping');
            }
          }, 20000);
        };

        socket.onmessage = (event) => {
          try {
            if (event.data === 'pong') return;
            const data = JSON.parse(event.data);

            // Forward to all subscribers (AppDataContext etc.)
            listenersRef.current.forEach((cb) => {
              try {
                cb(data);
              } catch (err) {
                console.error('Error in socket listener:', err);
              }
            });

            if (data.type === 'NEW_PAYMENT_REPORTED') {
              const item: NotificationItem = {
                id: data.payment.id,
                type: data.type,
                message: `Nuevo pago reportado: ${data.payment.tenant_name} (${data.payment.origin_bank} $${data.payment.amount})`,
                timestamp: new Date().toLocaleTimeString(),
                data: data.payment,
              };
              setNotifications((prev) => [item, ...prev]);
              setUnreadCount((c) => c + 1);
              setLastEventTimestamp(Date.now());
            } else if (data.type === 'EXCHANGE_RATE_UPDATED') {
              const item: NotificationItem = {
                id: `rate-${Date.now()}`,
                type: 'EXCHANGE_RATE_UPDATED',
                message: `Tasa oficial BCV actualizada en BDD: ${Number(data.rate).toFixed(2)} Bs/USD`,
                timestamp: new Date().toLocaleTimeString(),
                data: { rate: data.rate },
              };
              setNotifications((prev) => [item, ...prev]);
              setLastEventTimestamp(Date.now());
            } else if (data.type === 'WEBHOOK_DISPATCHED') {
              const item: NotificationItem = {
                id: `wh-${Date.now()}`,
                type: 'WEBHOOK_DISPATCHED',
                message: `Webhook despachado: ${data.event_type || 'evento'} hacia ${data.tenant_name || 'comercio'}`,
                timestamp: new Date().toLocaleTimeString(),
                data: data,
              };
              setNotifications((prev) => [item, ...prev]);
              setUnreadCount((c) => c + 1);
              setLastEventTimestamp(Date.now());
            } else if (data.type === 'TENANT_STATUS_CHANGED') {
              const item: NotificationItem = {
                id: `status-${Date.now()}`,
                type: 'TENANT_STATUS_CHANGED',
                message: `Estado actualizado: ${data.commercial_name || data.tax_id} -> ${data.status.toUpperCase()}`,
                timestamp: new Date().toLocaleTimeString(),
                data: data,
              };
              setNotifications((prev) => [item, ...prev]);
              setLastEventTimestamp(Date.now());
            } else if (data.type === 'TENANT_CREATED') {
              const item: NotificationItem = {
                id: `created-${Date.now()}`,
                type: 'TENANT_CREATED',
                message: `Nuevo cliente registrado: ${data.commercial_name || data.tax_id}`,
                timestamp: new Date().toLocaleTimeString(),
                data: data,
              };
              setNotifications((prev) => [item, ...prev]);
              setLastEventTimestamp(Date.now());
            } else if (data.type === 'INVOICE_ISSUED') {
              const item: NotificationItem = {
                id: `inv-${Date.now()}`,
                type: 'INVOICE_ISSUED',
                message: `Factura ${data.numero_comprobante} emitida ($${data.monto_usd})`,
                timestamp: new Date().toLocaleTimeString(),
                data: data,
              };
              setNotifications((prev) => [item, ...prev]);
              setLastEventTimestamp(Date.now());
            } else if (
              data.type === 'PAYMENT_APPROVED' ||
              data.type === 'PAYMENT_REJECTED' ||
              data.type === 'TOLERANCE_EXTENDED' ||
              data.type === 'TENANT_UPDATED'
            ) {
              setLastEventTimestamp(Date.now());
            }
          } catch (e) {
            console.error('Error procesando mensaje WebSocket:', e);
          }
        };

        socket.onclose = () => {
          setWsConnected(false);
          if (pingInterval) clearInterval(pingInterval);
          reconnectTimeout = setTimeout(connect, 3000);
        };

        socket.onerror = (err) => {
          console.error('[WebSocket] Error:', err);
          setWsConnected(false);
          socket?.close();
        };
      } catch (e) {
        console.error('[WebSocket] Fallo de conexión inicial:', e);
        setWsConnected(false);
      }
    };

    connect();

    return () => {
      if (pingInterval) clearInterval(pingInterval);
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [token]);

  const clearNotifications = () => {
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        clearNotifications,
        lastEventTimestamp,
        addNotification,
        wsConnected,
        subscribeToSocket,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

