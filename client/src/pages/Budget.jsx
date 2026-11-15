import { useState } from 'react';
import { Check, Copy, Pencil, Plus, Target, X } from 'lucide-react';
import { deleteLimit, fetchBudget, getErrorMessage, setLimit } from '../api';
import { BudgetRow, budgetStatus } from '../components/BudgetRow';
import { useApp } from '../context';
import { useResource } from '../hooks/useResource';
import { money, monthShort, plural, shiftMonth } from '../lib/format';

function LimitEditor({ limit, onSave, onCancel }) {
  const [value, setValue] = useState(String(limit.limit));
  return (
    <form
      style={{ display: 'flex', gap: 6 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(Number(value.replace(',', '.')));
      }}
    >
      <input id={`limit-${limit.category}`} className="input num" style={{ width: 96, height: 30 }} value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" autoFocus aria-label="Лимит, Br" />
      <button type="submit" className="btn btn-sm btn-icon btn-primary" aria-label="Сохранить"><Check size={14} /></button>
      <button type="button" className="btn btn-sm btn-icon btn-ghost" onClick={onCancel} aria-label="Отмена"><X size={14} /></button>
    </form>
  );
}

export function Budget() {
  const { month, dataVersion, catalog, toast } = useApp();
  const budget = useResource((signal) => fetchBudget(month, signal), [month, dataVersion]);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ category: '', limit: '' });

  const limits = budget.data?.limits || [];
  const used = new Set(limits.map((l) => l.category));
  const free = (catalog?.expense || []).filter((c) => !used.has(c.name));
  const totalLimit = limits.reduce((s, l) => s + l.limit, 0);
  const totalSpent = limits.reduce((s, l) => s + l.spent, 0);
  const over = limits.filter((l) => budgetStatus(l.spent, l.limit).key === 'critical').length;
  const status = budgetStatus(totalSpent, totalLimit);

  // PATCH лимита: на сервере — обновление элемента массива через arrayFilters
  async function save(category, value) {
    if (!(value >= 0)) return toast('Лимит должен быть числом не меньше 0', 'error');
    try {
      budget.setData(await setLimit(month, category, value));
      setEditing(null);
      toast(`Лимит «${category}»: ${money(value, { round: true })}`);
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  }

  async function remove(category) {
    try {
      budget.setData(await deleteLimit(month, category));
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  }

  async function copyPrevious() {
    try {
      const prev = await fetchBudget(shiftMonth(month, -1));
      if (!prev.limits.length) return toast('В прошлом месяце лимитов тоже нет', 'error');
      let result;
      for (const l of prev.limits) result = await setLimit(month, l.category, l.limit);
      budget.setData(result);
      toast(`Скопировано ${prev.limits.length} ${plural(prev.limits.length, 'лимит', 'лимита', 'лимитов')}`);
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  }

  return (
    <div className="grid">
      <section className="card span-4" style={{ alignSelf: 'start' }}>
        <span className="eyebrow">Бюджет на {monthShort(month).toLowerCase()}</span>
        <div>
          <div className="stat-value num">{money(totalSpent)}</div>
          <div className="muted num">из {money(totalLimit, { round: true })} по {limits.length} {plural(limits.length, 'категории', 'категориям', 'категориям')}</div>
        </div>
        <div className="progress" data-status={status.key} style={{ height: 10 }}>
          <span style={{ width: `${Math.min(status.ratio, 1) * 100}%` }} />
        </div>
        <span className={`status ${over ? 'critical' : status.key}`}>
          <status.Icon size={14} />
          {over ? `Превышено в ${over} ${plural(over, 'категории', 'категориях', 'категориях')}` : status.label}
        </span>

        <form
          style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16, borderTop: '1px solid var(--line)' }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.category) return;
            save(draft.category, Number(String(draft.limit).replace(',', '.')));
            setDraft({ category: '', limit: '' });
          }}
        >
          <b style={{ fontSize: 14 }}>Новый лимит</b>
          <div className="form-row">
            <select id="limit-new-category" className="select" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} aria-label="Категория">
              <option value="">Категория</option>
              {free.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
            <input id="limit-new-value" className="input num" value={draft.limit} onChange={(e) => setDraft({ ...draft, limit: e.target.value })} placeholder="Лимит, Br" inputMode="decimal" aria-label="Лимит" />
          </div>
          <button type="submit" className="btn" style={{ alignSelf: 'flex-start' }} disabled={!draft.category}>
            <Plus size={15} /> Добавить
          </button>
        </form>
      </section>

      <section className="card span-8">
        <div className="card-head">
          <h2>Лимиты по категориям</h2>
          {budget.loading && budget.data && <i className="spinner" />}
        </div>
        {budget.error && (
          <div className="error-block">
            <span>{budget.error}</span>
            <button type="button" className="btn" onClick={budget.reload}>Повторить</button>
          </div>
        )}
        {!budget.data && budget.loading && <div className="loading-block"><i className="spinner" /> Загружаем бюджет…</div>}
        {budget.data && !limits.length && (
          <div className="empty">
            <Target size={32} />
            <b style={{ color: 'var(--ink)' }}>Лимиты на {monthShort(month).toLowerCase()} не заданы</b>
            <button type="button" className="btn btn-sm" onClick={copyPrevious}>
              <Copy size={14} /> Взять лимиты прошлого месяца
            </button>
          </div>
        )}
        {limits.map((l) => (
          <BudgetRow key={l.category} limit={l}>
            {editing === l.category ? (
              <LimitEditor limit={l} onSave={(v) => save(l.category, v)} onCancel={() => setEditing(null)} />
            ) : (
              <>
                <button type="button" className="btn btn-sm btn-icon btn-ghost" onClick={() => setEditing(l.category)} aria-label={`Изменить лимит ${l.category}`}>
                  <Pencil size={14} />
                </button>
                <button type="button" className="btn btn-sm btn-icon btn-ghost" onClick={() => remove(l.category)} aria-label={`Убрать лимит ${l.category}`}>
                  <X size={14} />
                </button>
              </>
            )}
          </BudgetRow>
        ))}
      </section>
    </div>
  );
}
