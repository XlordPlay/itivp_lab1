import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { addTransaction, getErrorMessage, updateTransaction } from '../api';
import { useApp } from '../context';
import { isoDay, money } from '../lib/format';
import { CategoryIcon } from './CategoryIcon';

function emptyForm(accounts) {
  return {
    type: 'expense',
    amount: '',
    category: 'Продукты',
    date: isoDay(),
    account: accounts[0]?._id || '',
    description: '',
    tags: [],
    items: [],
  };
}

function fromTransaction(tx) {
  return {
    type: tx.type,
    amount: String(tx.amount),
    category: tx.category.name,
    date: tx.date.slice(0, 10),
    account: tx.account?._id || '',
    description: tx.description,
    tags: tx.tags,
    items: tx.items.map((i) => ({ name: i.name, qty: String(i.qty), price: String(i.price) })),
  };
}

const toNumber = (v) => Number(String(v).replace(',', '.'));

// Выезжающая панель добавления и редактирования операции
export function TransactionEditor({ tx, onClose }) {
  const { catalog, accounts, toast, bumpData } = useApp();
  const [form, setForm] = useState(() => (tx ? fromTransaction(tx) : emptyForm(accounts)));
  const [tagDraft, setTagDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const categories = catalog?.[form.type] || [];
  const itemsTotal = form.items.reduce((s, i) => s + (toNumber(i.qty) || 0) * (toNumber(i.price) || 0), 0);
  const hasItems = form.items.some((i) => i.name.trim());

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  function switchType(type) {
    const list = catalog?.[type] || [];
    set({ type, category: list.some((c) => c.name === form.category) ? form.category : list[0]?.name });
  }

  function addTag() {
    const tag = tagDraft.trim().toLowerCase().replace(/^#/, '');
    if (tag && !form.tags.includes(tag)) set({ tags: [...form.tags, tag] });
    setTagDraft('');
  }

  function setItem(index, patch) {
    set({ items: form.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  }

  async function submit(event) {
    event.preventDefault();
    const items = form.items
      .filter((i) => i.name.trim())
      .map((i) => ({ name: i.name.trim(), qty: toNumber(i.qty) || 1, price: toNumber(i.price) || 0 }));
    const amount = items.length ? itemsTotal : toNumber(form.amount);
    if (!(amount > 0)) {
      setError('Укажите сумму больше нуля или добавьте позиции чека');
      return;
    }
    const payload = { ...form, amount, items, account: form.account || null };
    setSaving(true);
    setError('');
    try {
      if (tx) await updateTransaction(tx._id, payload);
      else await addTransaction(payload);
      toast(tx ? 'Изменения сохранены' : `Операция на ${money(amount)} добавлена`);
      bumpData();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <form className="sheet" onSubmit={submit} aria-label={tx ? 'Редактирование операции' : 'Новая операция'}>
        <div className="sheet-head">
          <h2>{tx ? 'Редактирование' : 'Новая операция'}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        <div className="sheet-body">
          <div className="segmented" role="group" aria-label="Тип операции" style={{ alignSelf: 'flex-start' }}>
            <button type="button" aria-pressed={form.type === 'expense'} onClick={() => switchType('expense')}>Расход</button>
            <button type="button" aria-pressed={form.type === 'income'} onClick={() => switchType('income')}>Доход</button>
          </div>

          <label className="field">
            <span>{hasItems ? 'Сумма считается по позициям чека' : 'Сумма'}</span>
            <div className="amount-input">
              <input
                id="tx-amount"
                className="num"
                value={hasItems ? itemsTotal.toFixed(2) : form.amount}
                onChange={(e) => set({ amount: e.target.value })}
                placeholder="0,00"
                inputMode="decimal"
                readOnly={hasItems}
                autoFocus={!tx}
              />
              <span>Br</span>
            </div>
          </label>

          <div className="field">
            <span>Категория</span>
            <div className="cat-grid">
              {categories.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className="cat-tile"
                  aria-pressed={form.category === c.name}
                  onClick={() => set({ category: c.name })}
                >
                  <CategoryIcon name={c.name} type={form.type} small />
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <label className="field">
              <span>Дата</span>
              <input id="tx-date" type="date" className="input" value={form.date} onChange={(e) => set({ date: e.target.value })} />
            </label>
            <label className="field">
              <span>Счёт</span>
              <select id="tx-account" className="select" value={form.account} onChange={(e) => set({ account: e.target.value })}>
                <option value="">Без счёта</option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>{a.name}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Описание</span>
            <input id="tx-description" className="input" value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Например, «Евроопт» или «Обед с коллегами»" />
          </label>

          <div className="field">
            <span>Теги</span>
            <div className="tag-input">
              {form.tags.map((tag) => (
                <button key={tag} type="button" className="chip" onClick={() => set({ tags: form.tags.filter((t) => t !== tag) })} aria-label={`Убрать тег ${tag}`}>
                  #{tag} <X size={12} />
                </button>
              ))}
              <input
                id="tx-tag"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                onBlur={addTag}
                placeholder={form.tags.length ? '' : 'кофе, работа… Enter — добавить'}
              />
            </div>
          </div>

          <div className="field">
            <span>Позиции чека</span>
            <div className="items-editor">
              {form.items.map((item, index) => (
                <div key={index} className="item-row">
                  <input className="input" value={item.name} onChange={(e) => setItem(index, { name: e.target.value })} placeholder="Название" aria-label="Название позиции" />
                  <input className="input num" value={item.qty} onChange={(e) => setItem(index, { qty: e.target.value })} inputMode="numeric" aria-label="Количество" />
                  <input className="input num" value={item.price} onChange={(e) => setItem(index, { price: e.target.value })} placeholder="Цена" inputMode="decimal" aria-label="Цена" />
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => set({ items: form.items.filter((_, i) => i !== index) })} aria-label="Удалить позицию">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set({ items: [...form.items, { name: '', qty: '1', price: '' }] })}>
                <Plus size={14} /> Добавить позицию
              </button>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="sheet-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving && <i className="spinner" style={{ borderTopColor: 'currentColor' }} />}
            {tx ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </form>
    </>
  );
}
