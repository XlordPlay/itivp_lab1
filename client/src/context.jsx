import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';

const AppContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}

// Общее состояние приложения: месяц, справочник категорий, счета, версия данных и уведомления
export function AppProvider({ value, children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (text, kind = 'success') => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, text, kind }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500);
    },
    [dismiss],
  );

  const categoryMeta = useCallback(
    (name, type) => {
      const lists = type ? [value.catalog?.[type] || []] : [value.catalog?.expense || [], value.catalog?.income || []];
      for (const list of lists) {
        const found = list.find((c) => c.name === name);
        if (found) return found;
      }
      return { name, icon: 'package', slot: 0 };
    },
    [value.catalog],
  );

  const ctx = useMemo(() => ({ ...value, toast, categoryMeta }), [value, toast, categoryMeta]);

  return (
    <AppContext.Provider value={ctx}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === 'error' ? <CircleAlert size={18} /> : <CircleCheck size={18} />}
            <span>{t.text}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Закрыть">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
