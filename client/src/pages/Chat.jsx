import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, Clock, Hash, Lock, RotateCcw, TriangleAlert, Wifi, WifiOff } from 'lucide-react';
import { useRealtime } from '../realtime';

const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dayTime = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function stamp(iso) {
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString() ? time.format(date) : dayTime.format(date);
}

function Avatar({ user, small = false }) {
  return (
    <span className={`avatar${small ? ' sm' : ''}`} style={{ '--c': `var(--series-${(user.id % 8) + 1})` }} aria-hidden="true">
      {user.name.slice(0, 1)}
    </span>
  );
}

function StatusPill({ status }) {
  if (status === 'online') {
    return (
      <span className="pill good">
        <Wifi size={14} /> В сети
      </span>
    );
  }
  return (
    <span className="pill warn">
      <WifiOff size={14} /> {status === 'connecting' ? 'Подключение…' : 'Переподключение…'}
    </span>
  );
}

export function Chat() {
  const { socket, status, me, rooms, online, unread, clearUnread } = useRealtime();
  const [active, setActive] = useState({ type: 'room', id: 'family' });
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typing, setTyping] = useState({});
  const [text, setText] = useState('');
  const listRef = useRef(null);
  const typingRef = useRef({ on: false, timer: null });

  const room = rooms.find((r) => r.id === active.id);
  const partner = active.type === 'dm' ? online.find((u) => u.id === active.id) || active.user : null;

  useEffect(() => {
    if (!socket || status !== 'online') return;
    setLoading(true);
    setError('');
    setTyping({});
    const done = (res) => {
      setLoading(false);
      if (res?.ok) setMessages(res.history.map((m) => ({ ...m, status: 'sent' })));
      else setError(res?.error || 'Не удалось загрузить историю');
    };
    if (active.type === 'room') {
      socket.emit('room:join', active.id, done);
    } else {
      socket.emit('room:leave');
      socket.emit('dm:open', active.id, done);
      clearUnread(active.id);
    }
  }, [socket, status, active.type, active.id]);

  useEffect(() => {
    if (!socket || !me) return undefined;

    const isHere = (m) =>
      active.type === 'room'
        ? m.room === active.id && !m.to
        : (m.from.id === active.id && m.to === me.id) || (m.from.id === me.id && m.to === active.id);

    const receive = (m) => {
      if (!isHere(m)) return;
      if (active.type === 'dm' && m.from.id === active.id) clearUnread(active.id);
      setMessages((list) => {
        if (list.some((x) => x.id === m.id)) return list;
        if (m.from.id === me.id && list.some((x) => x.status === 'sending' && x.text === m.text)) return list;
        return [...list, { ...m, status: 'sent' }];
      });
      setTyping((t) => {
        const next = { ...t };
        delete next[m.from.id];
        return next;
      });
    };

    const system = (text, at) =>
      setMessages((list) => [...list, { id: `sys-${Date.now()}-${Math.random()}`, system: true, text, createdAt: at || new Date().toISOString() }]);

    const onRoomSystem = (e) => active.type === 'room' && e.room === active.id && system(e.text, e.at);
    const onOnline = ({ user, at }) => user.id !== me.id && system(`Пользователь ${user.name} подключился`, at);
    const onOffline = ({ user, at }) => user.id !== me.id && system(`Пользователь ${user.name} отключился`, at);

    const onTyping = (e) => {
      const here = active.type === 'room' ? e.room === active.id : e.dm === active.id;
      if (!here || e.user.id === me.id) return;
      setTyping((t) => {
        const next = { ...t };
        if (e.typing) next[e.user.id] = { name: e.user.name, until: Date.now() + 4000 };
        else delete next[e.user.id];
        return next;
      });
    };

    socket.on('message:new', receive);
    socket.on('message:private', receive);
    socket.on('room:system', onRoomSystem);
    socket.on('user:online', onOnline);
    socket.on('user:offline', onOffline);
    socket.on('typing', onTyping);
    return () => {
      socket.off('message:new', receive);
      socket.off('message:private', receive);
      socket.off('room:system', onRoomSystem);
      socket.off('user:online', onOnline);
      socket.off('user:offline', onOffline);
      socket.off('typing', onTyping);
    };
  }, [socket, me, active.type, active.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTyping((t) => {
        const fresh = Object.fromEntries(Object.entries(t).filter(([, v]) => v.until > Date.now()));
        return Object.keys(fresh).length === Object.keys(t).length ? t : fresh;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  function target() {
    return active.type === 'room' ? { room: active.id } : { to: active.id };
  }

  function emitTyping(value) {
    socket?.emit('typing', { ...target(), typing: value });
  }

  function stopTyping() {
    clearTimeout(typingRef.current.timer);
    if (typingRef.current.on) emitTyping(false);
    typingRef.current.on = false;
  }

  function onInput(value) {
    setText(value);
    if (!value.trim()) return stopTyping();
    if (!typingRef.current.on) {
      emitTyping(true);
      typingRef.current.on = true;
    }
    clearTimeout(typingRef.current.timer);
    typingRef.current.timer = setTimeout(stopTyping, 2000);
  }

  function deliver(temp) {
    const event = active.type === 'room' ? 'message:send' : 'message:private';
    socket.timeout(5000).emit(event, { ...target(), text: temp.text }, (err, res) => {
      if (err || !res?.ok) {
        const reason = err ? 'Сервер не подтвердил доставку' : res.error;
        setMessages((list) => list.map((x) => (x.id === temp.id ? { ...x, status: 'failed', error: reason } : x)));
        return;
      }
      setMessages((list) =>
        list.some((x) => x.id === res.message.id)
          ? list.filter((x) => x.id !== temp.id)
          : list.map((x) => (x.id === temp.id ? { ...res.message, status: 'sent' } : x)),
      );
    });
  }

  function send(event) {
    event.preventDefault();
    const value = text.trim();
    if (!value || !socket || !me) return;
    const temp = { id: `tmp-${Date.now()}`, from: me, text: value, createdAt: new Date().toISOString(), status: 'sending' };
    setMessages((list) => [...list, temp]);
    setText('');
    stopTyping();
    deliver(temp);
  }

  function retry(message) {
    setMessages((list) => list.map((x) => (x.id === message.id ? { ...x, status: 'sending', error: '' } : x)));
    deliver(message);
  }

  function open(next) {
    stopTyping();
    setMessages([]);
    setActive(next);
  }

  const typingNames = Object.values(typing).map((t) => t.name);
  const others = online.filter((u) => u.id !== me?.id);

  return (
    <div className="chat-layout">
      <aside className="card chat-side">
        <span className="eyebrow">Комнаты</span>
        <nav className="chat-rooms" aria-label="Комнаты">
          {rooms.map((r) => (
            <button key={r.id} type="button" aria-pressed={active.type === 'room' && active.id === r.id} onClick={() => open({ type: 'room', id: r.id })}>
              <Hash size={16} />
              <span>
                <b>{r.name}</b>
                <small>{r.description}</small>
              </span>
            </button>
          ))}
        </nav>

        <span className="eyebrow">В сети · {online.length}</span>
        <ul className="chat-people">
          {me && (
            <li>
              <Avatar user={me} small />
              <span>{me.name}</span>
              <small className="muted">это вы</small>
            </li>
          )}
          {others.map((u) => (
            <li key={u.id}>
              <button type="button" aria-pressed={active.type === 'dm' && active.id === u.id} onClick={() => open({ type: 'dm', id: u.id, user: u })} title={`Личное сообщение: ${u.name}`}>
                <Avatar user={u} small />
                <span>{u.name}</span>
                {unread[u.id] > 0 ? <span className="badge num">{unread[u.id]}</span> : <Lock size={13} className="muted" />}
              </button>
            </li>
          ))}
          {!others.length && <li className="muted" style={{ fontSize: 13 }}>Больше никого нет. Откройте второе окно под другим пользователем.</li>}
        </ul>
      </aside>

      <section className="card chat-main">
        <header className="chat-head">
          <div style={{ minWidth: 0 }}>
            <h2>
              {active.type === 'room' ? (
                <>
                  <Hash size={17} /> {room?.name || 'Комната'}
                </>
              ) : (
                <>
                  <Lock size={16} /> {partner?.name || 'Личный диалог'}
                </>
              )}
            </h2>
            <span className="muted">{active.type === 'room' ? room?.description : 'Личные сообщения видите только вы двое'}</span>
          </div>
          <StatusPill status={status} />
        </header>

        <div className="chat-thread" ref={listRef} aria-live="polite">
          {loading && <div className="loading-block"><i className="spinner" /> Загружаем историю…</div>}
          {error && <div className="error-block">{error}</div>}
          {!loading && !messages.length && !error && <div className="empty">Здесь пока тихо. Напишите первое сообщение.</div>}
          {messages.map((m) =>
            m.system ? (
              <div key={m.id} className="chat-system">
                {m.text} · {stamp(m.createdAt)}
              </div>
            ) : (
              <div key={m.id} className={`chat-msg${m.from.id === me?.id ? ' mine' : ''}`}>
                {m.from.id !== me?.id && <Avatar user={m.from} />}
                <div className="chat-bubble-wrap">
                  {m.from.id !== me?.id && <span className="chat-author">{m.from.name}</span>}
                  <div className="chat-bubble">{m.text}</div>
                  <span className="chat-meta">
                    {stamp(m.createdAt)}
                    {m.from.id === me?.id && m.status === 'sending' && <Clock size={12} aria-label="Отправляется" />}
                    {m.from.id === me?.id && m.status === 'sent' && <Check size={13} aria-label="Доставлено" />}
                    {m.status === 'failed' && (
                      <button type="button" className="chat-retry" onClick={() => retry(m)}>
                        <TriangleAlert size={12} /> {m.error} · <RotateCcw size={12} /> повторить
                      </button>
                    )}
                  </span>
                </div>
              </div>
            ),
          )}
        </div>

        <div className="chat-typing" aria-live="polite">
          {typingNames.length > 0 && (
            <>
              <span className="typing-dots"><i /><i /><i /></span>
              {typingNames.join(', ')} {typingNames.length > 1 ? 'печатают' : 'печатает'}…
            </>
          )}
        </div>

        <form className="chat-composer" onSubmit={send}>
          <input
            id="chat-input"
            className="input"
            value={text}
            onChange={(e) => onInput(e.target.value)}
            onBlur={stopTyping}
            placeholder={status === 'online' ? 'Сообщение…' : 'Нет соединения с сервером'}
            disabled={status !== 'online'}
            maxLength={1000}
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary btn-icon" disabled={!text.trim() || status !== 'online'} aria-label="Отправить">
            <ArrowUp size={18} />
          </button>
        </form>
      </section>
    </div>
  );
}
