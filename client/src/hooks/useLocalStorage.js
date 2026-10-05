import { useEffect, useState } from 'react';

const KEY = 'finance_transactions';

const INITIAL = [
  { id: 1, type: 'income', amount: 85000, category: 'Зарплата', description: 'Зарплата за август' },
  { id: 2, type: 'expense', amount: 4200, category: 'Продукты', description: 'Покупка в супермаркете' },
  { id: 3, type: 'expense', amount: 1500, category: 'Транспорт', description: 'Проездной на месяц' },
];

export function useLocalStorage() {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const raw = localStorage.getItem(KEY);
      setItems(raw ? JSON.parse(raw) : INITIAL);
      setReady(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    const timer = setTimeout(() => {
      localStorage.setItem(KEY, JSON.stringify(items));
    }, 500);
    return () => clearTimeout(timer);
  }, [items, ready]);

  return [items, setItems, ready];
}
