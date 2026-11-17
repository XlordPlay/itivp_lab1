import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { LOGOUT_EVENT, setSocketId } from './api';
import { useApp } from './context';
import { money } from './lib/format';

const RealtimeContext = createContext(null);

export function useRealtime() {
  return useContext(RealtimeContext);
}

const ACTIONS = { created: 'добавлена', updated: 'изменена', deleted: 'удалена' };

export function RealtimeProvider({ token, route, children }) {
  const { toast, bumpData } = useApp();
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [me, setMe] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [online, setOnline] = useState([]);
  const [unread, setUnread] = useState({});
  const routeRef = useRef(route);
  const meRef = useRef(null);
  const appRef = useRef({ toast, bumpData });

  useEffect(() => {
    routeRef.current = route;
    appRef.current = { toast, bumpData };
  });

  useEffect(() => {
    const notify = (text, kind) => appRef.current.toast(text, kind);
    const client = io(import.meta.env.VITE_API_URL, { auth: { token } });
    setSocket(client);

    client.on('connect', () => {
      setStatus('online');
      setSocketId(client.id);
    });
    client.on('disconnect', (reason) => {
      setStatus(reason === 'io client disconnect' ? 'offline' : 'reconnecting');
      setSocketId(null);
    });
    client.on('connect_error', (err) => {
      if (err.message === 'unauthorized') {
        localStorage.removeItem('token');
        window.dispatchEvent(new Event(LOGOUT_EVENT));
      } else {
        setStatus('reconnecting');
      }
    });
    client.io.on('reconnect_attempt', () => setStatus('reconnecting'));

    client.on('hello', (data) => {
      meRef.current = data.me;
      setMe(data.me);
      setRooms(data.rooms);
      setOnline(data.online);
    });
    client.on('presence', setOnline);
    client.on('user:online', ({ user }) => notify(`${user.name} в сети`, 'info'));
    client.on('user:offline', ({ user }) => notify(`${user.name} не в сети`, 'info'));

    client.on('transaction:changed', ({ action, transaction }) => {
      const t = transaction || {};
      notify(`Синхронизация: операция ${ACTIONS[action]} — ${t.description || t.category?.name || ''} ${t.amount ? money(t.amount) : ''}`.trim(), 'info');
      appRef.current.bumpData();
    });

    client.on('message:private', (message) => {
      if (message.from.id === meRef.current?.id) return;
      if (routeRef.current !== 'chat') notify(`${message.from.name}: ${message.text}`, 'info');
      setUnread((u) => ({ ...u, [message.from.id]: (u[message.from.id] || 0) + 1 }));
    });

    return () => {
      client.removeAllListeners();
      client.disconnect();
      setSocketId(null);
    };
  }, [token]);

  const value = useMemo(
    () => ({
      socket,
      status,
      me,
      rooms,
      online,
      unread,
      clearUnread: (userId) => setUnread((u) => ({ ...u, [userId]: 0 })),
      totalUnread: Object.values(unread).reduce((s, n) => s + n, 0),
    }),
    [socket, status, me, rooms, online, unread],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
