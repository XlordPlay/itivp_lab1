import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Target,
  Wallet,
  X,
} from 'lucide-react';
import { fetchAccounts, fetchCategories, LOGOUT_EVENT } from './api';
import { Assistant } from './components/Assistant';
import { TransactionEditor } from './components/TransactionEditor';
import { AppProvider } from './context';
import { currentMonth, monthLabel, shiftMonth } from './lib/format';
import { useTheme } from './lib/theme';
import { Accounts } from './pages/Accounts';
import { Budget } from './pages/Budget';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Transactions } from './pages/Transactions';

const ROUTES = {
  overview: { title: 'Обзор', Icon: LayoutDashboard, Page: Overview, month: true },
  transactions: { title: 'Операции', Icon: ArrowLeftRight, Page: Transactions, month: true },
  accounts: { title: 'Счета', Icon: Wallet, Page: Accounts },
  budget: { title: 'Бюджет', Icon: Target, Page: Budget, month: true },
  assistant: { title: 'Ассистент', Icon: Sparkles },
};

function useHashRoute() {
  const read = () => (ROUTES[window.location.hash.slice(1)] ? window.location.hash.slice(1) : 'overview');
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onHash = () => setRoute(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

function Workspace({ email, onLogout, theme }) {
  const route = useHashRoute();
  const [month, setMonth] = useState(currentMonth);
  const [catalog, setCatalog] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [dataVersion, setDataVersion] = useState(0);
  const [editor, setEditor] = useState(null); // { tx } | null
  const [chatOpen, setChatOpen] = useState(false);

  const reloadAccounts = useCallback(() => {
    fetchAccounts().then(setAccounts).catch(() => {});
  }, []);

  useEffect(() => {
    fetchCategories().then(setCatalog).catch(() => {});
  }, []);

  useEffect(reloadAccounts, [reloadAccounts, dataVersion]);

  const value = useMemo(
    () => ({
      month,
      catalog,
      accounts,
      dataVersion,
      theme,
      bumpData: () => setDataVersion((v) => v + 1),
      reloadAccounts,
      openEditor: (tx) => setEditor({ tx }),
    }),
    [month, catalog, accounts, dataVersion, theme, reloadAccounts],
  );

  const current = ROUTES[route];
  const Page = current.Page;

  useEffect(() => {
    document.title = `${current.title} · Сальдо`;
  }, [current.title]);
  const isCurrentMonth = month === currentMonth();

  return (
    <AppProvider value={value}>
      <div className="shell">
        <aside className="rail">
          <div className="brand">
            <span className="brand-mark">С</span>
            сальдо
          </div>
          <nav className="nav" aria-label="Разделы">
            {Object.entries(ROUTES).map(([key, r]) => (
              <a key={key} href={`#${key}`} aria-current={route === key ? 'page' : undefined}>
                <r.Icon size={18} />
                {r.title}
                {key === 'assistant' && <span className="nav-badge">ИИ</span>}
              </a>
            ))}
          </nav>
          <div className="rail-foot">
            <div className="rail-user">
              <span title={email}>{email}</span>
              <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onLogout} aria-label="Выйти" title="Выйти">
                <LogOut size={15} />
              </button>
            </div>
            <span className="muted" style={{ fontSize: 12 }}>Данные: MongoDB · вход: PostgreSQL</span>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <h1 className="page-title">{current.title}</h1>
            {current.month && (
              <div className="month-stepper" role="group" aria-label="Месяц">
                <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Предыдущий месяц">
                  <ChevronLeft size={16} />
                </button>
                <strong>{monthLabel(month)}</strong>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setMonth(shiftMonth(month, 1))} disabled={isCurrentMonth} aria-label="Следующий месяц">
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
            <button type="button" className="btn btn-ghost btn-icon" onClick={theme.toggle} aria-label={theme.resolved === 'dark' ? 'Светлая тема' : 'Тёмная тема'} title="Сменить тему">
              {theme.resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setEditor({ tx: null })}>
              <Plus size={16} />
              <span className="hide-sm">Операция</span>
            </button>
          </header>

          <main className="content" style={route === 'assistant' ? { flex: 1, minHeight: 0 } : undefined}>
            {route === 'assistant' ? (
              <section className="card" style={{ padding: 0, flex: 1, minHeight: 'calc(100vh - 120px)' }}>
                <Assistant />
              </section>
            ) : (
              <Page key={route} />
            )}
          </main>
        </div>
      </div>

      {route !== 'assistant' && !chatOpen && (
        <button type="button" className="btn btn-primary fab" onClick={() => setChatOpen(true)}>
          <Sparkles size={18} /> <span>Спросить ассистента</span>
        </button>
      )}

      {chatOpen && (
        <>
          <div className="overlay" onClick={() => setChatOpen(false)} />
          <aside className="sheet" aria-label="Ассистент">
            <div className="sheet-head">
              <h2>Ассистент</h2>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setChatOpen(false)} aria-label="Закрыть">
                <X size={18} />
              </button>
            </div>
            <Assistant />
          </aside>
        </>
      )}

      {editor && <TransactionEditor key={editor.tx?._id || 'new'} tx={editor.tx} onClose={() => setEditor(null)} />}
    </AppProvider>
  );
}

export default function App() {
  const theme = useTheme();
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [email, setEmail] = useState(() => localStorage.getItem('email') || '');

  // api.js сообщает о 401 — возвращаемся к форме входа
  useEffect(() => {
    const onLogout = () => setToken(null);
    window.addEventListener(LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(LOGOUT_EVENT, onLogout);
  }, []);

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
  }

  if (!token) {
    return (
      <Login
        onLogin={(t, mail) => {
          localStorage.setItem('email', mail);
          setEmail(mail);
          setToken(t);
        }}
      />
    );
  }
  return <Workspace email={email} onLogout={logout} theme={theme} />;
}
