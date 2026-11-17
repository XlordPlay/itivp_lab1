import { useEffect, useRef, useState } from 'react';
import { ArrowUp, CircleCheck, RotateCcw, Sparkles } from 'lucide-react';
import { askAssistant, fetchAiStatus, getErrorMessage } from '../api';
import { useApp } from '../context';

const KEY = 'saldo-chat';
const SUGGESTIONS = [
  'Сколько я потратил на кафе в этом месяце?',
  'Где я превышаю бюджет?',
  'Купил кофе за 6,5 Br — запиши',
  'Сравни расходы с прошлым месяцем',
];

function RichText({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : part,
  );
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function Assistant() {
  const { bumpData } = useApp();
  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [status, setStatus] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    fetchAiStatus().then(setStatus).catch(() => setStatus({ configured: false }));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(messages.slice(-30)));
    } catch {
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  async function send(text) {
    const content = text.trim();
    if (!content || thinking) return;
    const next = [...messages.filter((m) => m.role !== 'error'), { role: 'user', content }];
    setMessages(next);
    setInput('');
    setThinking(true);
    try {
      const { reply, actions } = await askAssistant(next.map(({ role, content: c }) => ({ role, content: c })));
      setMessages((list) => [...list, { role: 'assistant', content: reply, actions }]);
      if (actions?.length) bumpData();
    } catch (err) {
      setMessages((list) => [...list, { role: 'error', content: getErrorMessage(err) }]);
    } finally {
      setThinking(false);
    }
  }

  const notConfigured = status && !status.configured;

  return (
    <div className="assistant-panel">
      <div className="chat" ref={listRef}>
        {notConfigured && (
          <div className="setup">
            <b style={{ color: 'var(--ink)' }}>Ассистент ждёт ключ OpenRouter</b>
            <p>Добавьте ключ в файл .env в корне проекта и перезапустите API:</p>
            <pre>{'OPENROUTER_API_KEY=sk-or-...\nOPENROUTER_MODEL=openai/gpt-4o-mini'}</pre>
            <p>
              В Docker: <code>docker compose up -d --build api</code>
            </p>
          </div>
        )}

        {!messages.length && !notConfigured && (
          <div className="empty">
            <Sparkles size={28} />
            <b style={{ color: 'var(--ink)' }}>Спросите о своих деньгах</b>
            <p style={{ maxWidth: '36ch' }}>
              Ассистент видит ваши операции, счета и бюджет. Он может посчитать траты, найти перерасход и записать покупку
              за вас.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <RichText text={m.content} />
            {m.actions?.length > 0 && (
              <div className="msg-actions">
                {m.actions.map((a, j) => (
                  <div key={j} className="action-card">
                    <CircleCheck size={15} /> {a.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {thinking && (
          <div className="msg assistant typing" aria-label="Ассистент думает">
            <i />
            <i />
            <i />
          </div>
        )}
      </div>

      <div className="composer">
        {!messages.length && (
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => send(s)} disabled={notConfigured}>
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            id="assistant-input"
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Например: «обед 18 Br, тег работа»"
            disabled={notConfigured}
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary btn-icon" disabled={thinking || !input.trim()} aria-label="Отправить">
            <ArrowUp size={18} />
          </button>
          {messages.length > 0 && (
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setMessages([])} aria-label="Очистить чат" title="Очистить чат">
              <RotateCcw size={16} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
