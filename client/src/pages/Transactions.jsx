import { useMemo, useState } from 'react';
import { ChevronRight, Pencil, Receipt as ReceiptIcon, Search, Trash2 } from 'lucide-react';
import { deleteTransaction, fetchStats, fetchTransactions, getErrorMessage } from '../api';
import { CategoryIcon } from '../components/CategoryIcon';
import { Receipt } from '../components/Receipt';
import { useApp } from '../context';
import { useDebounce } from '../hooks/useDebounce';
import { useResource } from '../hooks/useResource';
import { dayLabel, money, plural, shortDate } from '../lib/format';

const TYPES = [
  ['', 'Все'],
  ['expense', 'Расходы'],
  ['income', 'Доходы'],
];

export function Transactions() {
  const { month, dataVersion, accounts, toast, bumpData, openEditor } = useApp();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [account, setAccount] = useState('');
  const [tag, setTag] = useState('');
  const [openId, setOpenId] = useState(null);
  const debounced = useDebounce(search, 350);

  // GET с фильтрами: при каждом новом фильтре предыдущий запрос отменяется (AbortController)
  const list = useResource(
    (signal) => fetchTransactions({ month, search: debounced || undefined, type: type || undefined, account: account || undefined, tag: tag || undefined }, signal),
    [month, debounced, type, account, tag, dataVersion],
  );
  const stats = useResource((signal) => fetchStats(month, signal), [month, dataVersion]);
  const items = useMemo(() => list.data || [], [list.data]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const tx of items) {
      const day = tx.date.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(tx);
    }
    return [...map.entries()];
  }, [items]);

  const totals = items.reduce(
    (acc, tx) => ({ ...acc, [tx.type]: acc[tx.type] + tx.amount }),
    { income: 0, expense: 0 },
  );

  function replace(updated) {
    list.setData((prev) => prev.map((tx) => (tx._id === updated._id ? updated : tx)));
  }

  // DELETE с оптимистичным обновлением и откатом
  async function remove(tx) {
    const previous = list.data;
    list.setData((prev) => prev.filter((t) => t._id !== tx._id));
    setOpenId(null);
    try {
      await deleteTransaction(tx._id);
      toast(`Операция «${tx.description || tx.category.name}» удалена`);
      bumpData();
    } catch (err) {
      list.setData(previous);
      toast(`Не удалось удалить: ${getErrorMessage(err)}`, 'error');
    }
  }

  return (
    <>
      <section className="card" style={{ gap: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="search">
            <Search size={16} />
            <input
              id="tx-search"
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по описанию, категории, тегам и позициям чека"
              aria-label="Поиск операций"
            />
          </label>
          <div className="segmented" role="group" aria-label="Тип операций">
            {TYPES.map(([value, label]) => (
              <button key={label} type="button" aria-pressed={type === value} onClick={() => setType(value)}>
                {label}
              </button>
            ))}
          </div>
          <select id="tx-account-filter" className="select" style={{ width: 'auto' }} value={account} onChange={(e) => setAccount(e.target.value)} aria-label="Счёт">
            <option value="">Все счета</option>
            {accounts.map((a) => (
              <option key={a._id} value={a._id}>{a.name}</option>
            ))}
          </select>
        </div>
        {stats.data?.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 13, marginRight: 4 }}>Теги:</span>
            {stats.data.tags.map((t) => (
              <button key={t.tag} type="button" className="chip" aria-pressed={tag === t.tag} onClick={() => setTag(tag === t.tag ? '' : t.tag)}>
                #{t.tag}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card" style={{ padding: 0, gap: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '16px 20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 16 }}>
              {items.length} {plural(items.length, 'операция', 'операции', 'операций')}
            </h2>
            {list.loading && list.data && <i className="spinner" aria-label="Обновление" />}
          </div>
          <div className="legend num">
            <span><i style={{ '--c': 'var(--income)' }} /> {money(totals.income)}</span>
            <span><i style={{ '--c': 'var(--expense)' }} /> {money(totals.expense)}</span>
          </div>
        </div>

        {list.error && (
          <div style={{ padding: '0 20px 20px' }}>
            <div className="error-block">
              <span>{list.error}</span>
              <button type="button" className="btn" onClick={list.reload}>Повторить</button>
            </div>
          </div>
        )}

        {!list.data && list.loading && (
          <div className="loading-block"><i className="spinner" /> Загружаем операции…</div>
        )}

        {list.data && !items.length && (
          <div className="empty">
            <ReceiptIcon size={32} />
            <b style={{ color: 'var(--ink)' }}>{debounced || type || tag || account ? 'Ничего не нашлось' : 'В этом месяце операций нет'}</b>
            <span>Измените фильтры или добавьте операцию</span>
          </div>
        )}

        {groups.map(([day, txs]) => {
          const net = txs.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
          return (
            <div key={day} className="day-group">
              <div className="day-head">
                <span>{dayLabel(`${day}T12:00:00Z`)}</span>
                <span className="num">{money(net, { sign: true })}</span>
              </div>
              <ul className="tx-list">
                {txs.map((tx) => {
                  const open = openId === tx._id;
                  return (
                    <li key={tx._id} className="tx" data-open={open}>
                      <button type="button" className="tx-row" onClick={() => setOpenId(open ? null : tx._id)} aria-expanded={open}>
                        <CategoryIcon name={tx.category.name} type={tx.type} icon={tx.category.icon} />
                        <span className="tx-main">
                          <span className="tx-title">{tx.description || tx.category.name}</span>
                          <span className="tx-meta">
                            <span>{tx.category.name}</span>
                            {tx.account && <span>· {tx.account.name}</span>}
                            {tx.items.length > 0 && <span>· {tx.items.length} {plural(tx.items.length, 'позиция', 'позиции', 'позиций')}</span>}
                            {tx.tags.map((t) => (
                              <span key={t} className="chip" style={{ height: 20 }}>#{t}</span>
                            ))}
                          </span>
                        </span>
                        <span className={`tx-amount num ${tx.type}`}>
                          {money(tx.type === 'income' ? tx.amount : -tx.amount, { sign: true })}
                        </span>
                        <ChevronRight size={18} className="tx-chevron" />
                      </button>

                      {open && (
                        <div className="tx-detail">
                          <div className="tx-facts">
                            <dl>
                              <dt>Дата</dt>
                              <dd>{shortDate(tx.date)}</dd>
                              <dt>Категория</dt>
                              <dd>{tx.category.name}</dd>
                              <dt>Счёт</dt>
                              <dd>{tx.account?.name || 'не указан'}</dd>
                              <dt>Теги</dt>
                              <dd>{tx.tags.length ? tx.tags.map((t) => `#${t}`).join(' ') : '—'}</dd>
                              <dt>Документ</dt>
                              <dd className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{tx._id}</dd>
                            </dl>
                            <div className="tx-actions">
                              <button type="button" className="btn btn-sm" onClick={() => openEditor(tx)}>
                                <Pencil size={14} /> Изменить
                              </button>
                              <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(tx)}>
                                <Trash2 size={14} /> Удалить
                              </button>
                            </div>
                          </div>
                          {tx.type === 'expense' && <Receipt tx={tx} onChange={replace} />}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>
    </>
  );
}
