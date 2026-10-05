import { useEffect, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const EMPTY = { type: 'expense', amount: '', category: '', description: '' };

export function TransactionList() {
  const [items, setItems, ready] = useLocalStorage();
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = `Финансы (${items.length})`;
  }, [items.length]);

  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  function submit(event) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.category.trim() || !amount || amount <= 0) {
      setError('Укажите категорию и сумму больше 0');
      return;
    }
    const next = { ...form, amount, category: form.category.trim() };
    if (editId) {
      setItems((prev) => prev.map((item) => (item.id === editId ? { ...item, ...next } : item)));
    } else {
      setItems((prev) => [...prev, { ...next, id: Date.now() }]);
    }
    setForm(EMPTY);
    setEditId(null);
    setError('');
  }

  function startEdit(item) {
    setEditId(item.id);
    setForm({
      type: item.type,
      amount: String(item.amount),
      category: item.category,
      description: item.description,
    });
  }

  function remove(id) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (editId === id) {
      setEditId(null);
      setForm(EMPTY);
    }
  }

  const visible = items.filter((item) => filter === 'all' || item.type === filter);
  const income = items.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const expense = items.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);

  if (!ready) return <p className="loading">Загрузка...</p>;

  return (
    <main className="page">
      <h1>Учёт личных финансов</h1>
      <section className="stats">
        <div>Доходы: {income} ₽</div>
        <div>Расходы: {expense} ₽</div>
        <div>Баланс: {income - expense} ₽</div>
      </section>

      <form onSubmit={submit} className="form">
        <select name="type" value={form.type} onChange={change}>
          <option value="expense">Расход</option>
          <option value="income">Доход</option>
        </select>
        <input name="amount" value={form.amount} onChange={change} placeholder="Сумма" inputMode="decimal" />
        <input name="category" value={form.category} onChange={change} placeholder="Категория" />
        <input name="description" value={form.description} onChange={change} placeholder="Описание" />
        <button type="submit">{editId ? 'Сохранить' : 'Добавить'}</button>
        {editId && (
          <button type="button" onClick={() => { setEditId(null); setForm(EMPTY); }}>
            Отмена
          </button>
        )}
      </form>
      {error && <p className="error">{error}</p>}

      <div className="filters">
        {[
          ['all', 'Все'],
          ['income', 'Доходы'],
          ['expense', 'Расходы'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={filter === value ? 'active' : ''}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="list">
        {visible.map((item) => (
          <li key={item.id} className={item.type}>
            <div>
              <strong>{item.category}</strong>
              <span>{item.description}</span>
            </div>
            <b>{item.type === 'income' ? '+' : '−'}{item.amount} ₽</b>
            <button type="button" onClick={() => startEdit(item)}>Изменить</button>
            <button type="button" onClick={() => remove(item.id)}>Удалить</button>
          </li>
        ))}
      </ul>
      {visible.length === 0 && <p>Операций нет</p>}
    </main>
  );
}
