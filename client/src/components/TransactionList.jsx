import { useEffect, useState } from 'react';
import {
  addTransaction,
  deleteTransaction,
  fetchCategories,
  fetchTransactions,
  getErrorMessage,
  isCanceled,
  updateTransaction,
} from '../api';
import { useDebounce } from '../hooks/useDebounce';

const EMPTY = { type: 'expense', amount: '', categoryId: '', description: '' };

// Сервер отдает amount строкой ("4200.00"), в интерфейсе нужно число
const normalize = (item) => ({ ...item, amount: Number(item.amount) });

// Временные id у записей, которые еще не сохранены на сервере
const isTemp = (id) => String(id).startsWith('tmp-');

export function TransactionList({ onLogout }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(0);
  const [notice, setNotice] = useState('');

  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [formError, setFormError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => {
    fetchCategories()
      .then(({ data }) => setCategories(data))
      .catch(() => setCategories([]));
  }, []);

  // GET: загрузка при старте, при новом поиске и по кнопке «Повторить».
  // AbortController отменяет устаревший запрос, если пользователь продолжил печатать
  // или компонент размонтировался.
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data } = await fetchTransactions(debouncedSearch, controller.signal);
        setItems(data.map(normalize));
        setLoading(false);
      } catch (err) {
        if (isCanceled(err)) return;
        setError(getErrorMessage(err));
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [debouncedSearch, reloadKey]);

  useEffect(() => {
    document.title = `Финансы (${items.length})`;
  }, [items.length]);

  // Счетчик фоновых запросов для индикатора «Сохранение...»
  async function track(request) {
    setSaving((n) => n + 1);
    try {
      return await request;
    } finally {
      setSaving((n) => n - 1);
    }
  }

  function categoryById(id) {
    return categories.find((category) => category.id === id);
  }

  // POST с оптимистичным обновлением
  async function create(payload) {
    const tempId = `tmp-${Date.now()}`;
    setItems((prev) => [...prev, { ...payload, id: tempId, Category: categoryById(payload.categoryId) }]);
    try {
      const { data } = await track(addTransaction(payload));
      setItems((prev) => prev.map((item) => (item.id === tempId ? normalize(data) : item)));
    } catch (err) {
      setItems((prev) => prev.filter((item) => item.id !== tempId));
      setNotice(`Не удалось добавить операцию: ${getErrorMessage(err)}`);
    }
  }

  // PUT с оптимистичным обновлением и откатом
  async function update(id, payload) {
    const previous = items.find((item) => item.id === id);
    const optimistic = { ...previous, ...payload, Category: categoryById(payload.categoryId), pending: true };
    setItems((prev) => prev.map((item) => (item.id === id ? optimistic : item)));
    try {
      const { data } = await track(updateTransaction(id, payload));
      setItems((prev) => prev.map((item) => (item.id === id ? normalize(data) : item)));
    } catch (err) {
      setItems((prev) => prev.map((item) => (item.id === id ? previous : item)));
      setNotice(`Не удалось сохранить изменения: ${getErrorMessage(err)}`);
    }
  }

  // DELETE: сразу убираем из списка, при ошибке возвращаем на прежнее место
  async function remove(target) {
    const index = items.findIndex((item) => item.id === target.id);
    setItems((prev) => prev.filter((item) => item.id !== target.id));
    if (editId === target.id) cancelEdit();
    try {
      await track(deleteTransaction(target.id));
    } catch (err) {
      setItems((prev) => [...prev.slice(0, index), target, ...prev.slice(index)]);
      setNotice(`Не удалось удалить операцию: ${getErrorMessage(err)}`);
    }
  }

  function change(event) {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  function submit(event) {
    event.preventDefault();
    const amount = Number(form.amount);
    const categoryId = Number(form.categoryId);
    if (!categoryId || !amount || amount <= 0) {
      setFormError('Выберите категорию и укажите сумму больше 0');
      return;
    }
    const payload = { type: form.type, amount, categoryId, description: form.description.trim() };
    if (editId) update(editId, payload);
    else create(payload);
    cancelEdit();
  }

  function startEdit(item) {
    setEditId(item.id);
    setFormError('');
    setForm({
      type: item.type,
      amount: String(item.amount),
      categoryId: String(item.categoryId),
      description: item.description,
    });
  }

  function cancelEdit() {
    setEditId(null);
    setForm(EMPTY);
    setFormError('');
  }

  const visible = items.filter((item) => filter === 'all' || item.type === filter);
  const income = items.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const expense = items.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);

  return (
    <main className="page">
      <header className="header">
        <h1>Учёт личных финансов</h1>
        {saving > 0 && <span className="saving"><i className="spinner small" /> Сохранение...</span>}
        <button type="button" onClick={onLogout}>Выйти</button>
      </header>

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
        <select name="categoryId" value={form.categoryId} onChange={change}>
          <option value="">Категория</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
        <input name="description" value={form.description} onChange={change} placeholder="Описание" />
        <button type="submit">{editId ? 'Сохранить' : 'Добавить'}</button>
        {editId && <button type="button" onClick={cancelEdit}>Отмена</button>}
      </form>
      {formError && <p className="error">{formError}</p>}

      {notice && (
        <p className="notice">
          {notice}
          <button type="button" onClick={() => setNotice('')}>×</button>
        </p>
      )}

      <div className="filters">
        <input
          className="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по описанию и категории"
        />
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

      {loading && (
        <p className="loading"><i className="spinner" /> Загрузка...</p>
      )}

      {!loading && error && (
        <div className="load-error">
          <p className="error">{error}</p>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)}>Повторить</button>
        </div>
      )}

      {!loading && !error && (
        <>
          <ul className="list">
            {visible.map((item) => {
              const pending = item.pending || isTemp(item.id);
              return (
                <li key={item.id} className={`${item.type}${pending ? ' pending' : ''}`}>
                  <div>
                    <strong>{item.Category?.name}</strong>
                    <span>{item.description}{pending && ' · сохранение...'}</span>
                  </div>
                  <b>{item.type === 'income' ? '+' : '−'}{item.amount} ₽</b>
                  <button type="button" disabled={pending} onClick={() => startEdit(item)}>Изменить</button>
                  <button type="button" disabled={pending} onClick={() => remove(item)}>Удалить</button>
                </li>
              );
            })}
          </ul>
          {visible.length === 0 && <p>{debouncedSearch ? 'Ничего не найдено' : 'Операций нет'}</p>}
        </>
      )}
    </main>
  );
}
