import { useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { addItem, changeItem, getErrorMessage, removeItem } from '../api';
import { useApp } from '../context';
import { money, shortDate } from '../lib/format';

const total = (items) => Math.round(items.reduce((s, i) => s + i.qty * i.price, 0) * 100) / 100;

// Позиции операции в виде кассового чека. Количество меняется через $inc по элементу массива
export function Receipt({ tx, onChange }) {
  const { toast } = useApp();
  const [draft, setDraft] = useState({ name: '', price: '' });
  const [busy, setBusy] = useState(false);

  // Оптимистично меняем позиции, при ошибке возвращаем прежний документ
  async function apply(optimisticItems, request) {
    const previous = tx;
    onChange({ ...tx, items: optimisticItems, amount: optimisticItems.length ? total(optimisticItems) : tx.amount });
    setBusy(true);
    try {
      onChange(await request());
    } catch (err) {
      onChange(previous);
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  function step(item, delta) {
    const items = tx.items.map((i) => (i._id === item._id ? { ...i, qty: i.qty + delta } : i));
    apply(items, () => changeItem(tx._id, item._id, { delta }));
  }

  function drop(item) {
    apply(tx.items.filter((i) => i._id !== item._id), () => removeItem(tx._id, item._id));
  }

  function add(event) {
    event.preventDefault();
    const price = Number(String(draft.price).replace(',', '.'));
    if (!draft.name.trim() || !(price >= 0)) return;
    const item = { _id: `tmp-${Date.now()}`, name: draft.name.trim(), qty: 1, price };
    setDraft({ name: '', price: '' });
    apply([...tx.items, item], () => addItem(tx._id, { name: item.name, price }));
  }

  return (
    <div className="receipt">
      <div className="receipt-head">
        Кассовый чек · {shortDate(tx.date)}
        {tx.description ? ` · ${tx.description}` : ''}
      </div>

      {tx.items.length === 0 && <p style={{ opacity: 0.7, padding: '6px 0' }}>Позиций нет. Добавьте первую ниже.</p>}

      {tx.items.map((item) => (
        <div key={item._id} className="receipt-line">
          <span className="receipt-name">
            <span>{item.name}</span>
          </span>
          <b className="num">{money(item.qty * item.price)}</b>
          <div className="receipt-qty">
            <button type="button" onClick={() => step(item, -1)} disabled={busy || item.qty <= 1} aria-label="Уменьшить количество">
              <Minus size={12} />
            </button>
            <span className="num">{item.qty}</span>
            <button type="button" onClick={() => step(item, 1)} disabled={busy} aria-label="Увеличить количество">
              <Plus size={12} />
            </button>
            <span className="num">× {money(item.price)}</span>
            <span className="spacer" />
            <button type="button" onClick={() => drop(item)} disabled={busy} aria-label={`Удалить ${item.name}`}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}

      <div className="receipt-total">
        <span>ИТОГО</span>
        <span className="num">{money(tx.amount)}</span>
      </div>

      <form className="receipt-add" onSubmit={add}>
        <input
          id={`item-name-${tx._id}`}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Новая позиция"
          aria-label="Название позиции"
        />
        <input
          id={`item-price-${tx._id}`}
          value={draft.price}
          onChange={(e) => setDraft({ ...draft, price: e.target.value })}
          placeholder="Цена"
          inputMode="decimal"
          aria-label="Цена позиции"
        />
        <button type="submit" className="btn btn-sm" disabled={busy}>
          <Plus size={14} /> В чек
        </button>
      </form>
    </div>
  );
}
