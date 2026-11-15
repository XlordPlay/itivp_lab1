import { ArrowDownRight, ArrowUpRight, ChevronRight, Wallet } from 'lucide-react';
import { fetchBudget, fetchStats, fetchTransactions } from '../api';
import { BudgetRow, budgetStatus } from '../components/BudgetRow';
import { CategoryIcon } from '../components/CategoryIcon';
import { CashflowChart, CategoryBars, DailyBars } from '../components/Charts';
import { useApp } from '../context';
import { useResource } from '../hooks/useResource';
import { currentMonth, isoDay, money, monthShort, percent, shiftMonth, shortDate } from '../lib/format';

const KIND = { card: 'Карта', cash: 'Наличные', savings: 'Накопления' };

function Delta({ now, before, goodWhenDown = false }) {
  if (!before) return <span className="delta">нет данных за прошлый месяц</span>;
  const change = ((now - before) / before) * 100;
  const up = change >= 0;
  const good = goodWhenDown ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`delta ${Math.abs(change) < 1 ? '' : good ? 'good' : 'bad'}`}>
      <Icon size={15} />
      {percent(Math.abs(change))} к прошлому месяцу
    </span>
  );
}

function Loading({ height = 120 }) {
  return <div className="skeleton" style={{ height }} />;
}

export function Overview() {
  const { month, dataVersion, accounts, openEditor } = useApp();
  const stats = useResource((signal) => fetchStats(month, signal), [month, dataVersion]);
  const budget = useResource((signal) => fetchBudget(month, signal), [month, dataVersion]);
  const recent = useResource((signal) => fetchTransactions({ month, limit: 6 }, signal), [month, dataVersion]);

  const s = stats.data;
  const isCurrent = month === currentMonth();
  const today = Number(isoDay().slice(8, 10));
  const daysPassed = isCurrent ? today : s?.daily.length || 30;
  const savingsRate = s?.income ? (s.balance / s.income) * 100 : 0;
  const monthName = monthShort(month).toLowerCase();

  if (stats.error) {
    return (
      <div className="error-block">
        <b>Не удалось загрузить сводку</b>
        <span>{stats.error}</span>
        <button type="button" className="btn" onClick={stats.reload}>Повторить</button>
      </div>
    );
  }

  const limits = [...(budget.data?.limits || [])]
    .sort((a, b) => budgetStatus(b.spent, b.limit).ratio - budgetStatus(a.spent, a.limit).ratio)
    .slice(0, 5);

  return (
    <>
      <div className="grid">
        <section className="card hero span-5" aria-label="Сальдо месяца">
          {s ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="eyebrow">Сальдо за {monthName}</span>
                <span className="hero-value num">{money(s.balance, { sign: true })}</span>
                <span style={{ color: 'var(--inverse-muted)', fontSize: 14 }}>
                  {s.count} операций · {isCurrent ? `${today}-й день месяца` : 'месяц закрыт'}
                </span>
              </div>
              <div className="hero-split">
                <div>
                  <small><span className="dot" style={{ '--c': 'var(--income)' }} /> Доходы</small>
                  <b className="num">{money(s.income)}</b>
                </div>
                <div>
                  <small><span className="dot" style={{ '--c': 'var(--expense)' }} /> Расходы</small>
                  <b className="num">{money(s.expense)}</b>
                </div>
              </div>
            </>
          ) : (
            <Loading height={170} />
          )}
        </section>

        <div className="span-7 grid tiles">
          <section className="card stat">
            <span className="eyebrow">Расходы</span>
            {s ? (
              <>
                <span className="stat-value num">{money(s.expense, { round: true })}</span>
                {isCurrent ? (
                  <span className="delta">за {daysPassed} дн. из {s.daily.length}</span>
                ) : (
                  <Delta now={s.expense} before={s.previous.expense} goodWhenDown />
                )}
                <div className="compare">
                  {[
                    [monthShort(month), s.expense, 'var(--expense)'],
                    [monthShort(shiftMonth(month, -1)), s.previous.expense, 'var(--line-strong)'],
                  ].map(([label, value, color]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <span className="bar-track"><span style={{ width: `${(value / Math.max(s.expense, s.previous.expense, 1)) * 100}%`, background: color }} /></span>
                      <b className="num">{money(value, { round: true })}</b>
                    </div>
                  ))}
                </div>
              </>
            ) : <Loading height={120} />}
          </section>
          <section className="card stat">
            <span className="eyebrow">В среднем в день</span>
            {s ? (
              <>
                <span className="stat-value num">{money(s.expense / Math.max(daysPassed, 1))}</span>
                <span className="delta">по {daysPassed} {daysPassed === 1 ? 'дню' : 'дням'} месяца</span>
                <DailyBars daily={s.daily} lastDay={isCurrent ? today : null} />
              </>
            ) : <Loading height={120} />}
          </section>
          <section className="card stat">
            <span className="eyebrow">Норма сбережений</span>
            {s ? (
              <>
                <span className="stat-value num">{s.income ? percent(savingsRate) : '—'}</span>
                <span className={`delta ${savingsRate >= 20 ? 'good' : savingsRate < 0 ? 'bad' : ''}`}>
                  {savingsRate >= 20 ? 'выше ориентира 20 %' : 'ориентир — 20 % дохода'}
                </span>
                <div className="goal" aria-hidden="true">
                  <span className="goal-fill" style={{ width: `${Math.max(Math.min(savingsRate, 100), 0)}%` }} />
                  <span className="goal-mark" style={{ left: '20%' }} />
                </div>
                <div className="goal-scale muted"><span>0</span><span style={{ marginLeft: '17%' }}>20 %</span><span style={{ marginLeft: 'auto' }}>100 %</span></div>
              </>
            ) : <Loading height={120} />}
          </section>
        </div>

        <section className="card span-8">
          <div className="card-head">
            <h2>Доходы и расходы</h2>
            <div className="legend">
              <span><i style={{ '--c': 'var(--income)' }} /> Доходы</span>
              <span><i style={{ '--c': 'var(--expense)' }} /> Расходы</span>
            </div>
          </div>
          {s ? (
            <CashflowChart daily={s.daily} lastDay={isCurrent ? today : null} monthGenitive={shortDate(`${month}-15T12:00:00Z`).split(' ')[1]} />
          ) : (
            <Loading height={260} />
          )}
        </section>

        <section className="card span-4">
          <div className="card-head">
            <h2>Куда ушли деньги</h2>
            <a href="#transactions">Все операции</a>
          </div>
          {s ? (
            s.byCategory.length ? <CategoryBars rows={s.byCategory} total={s.expense} /> : <p className="muted">Расходов за месяц нет</p>
          ) : (
            <Loading height={220} />
          )}
        </section>

        <section className="card span-5">
          <div className="card-head">
            <h2>Бюджет на {monthName}</h2>
            <a href="#budget">Настроить</a>
          </div>
          {budget.data ? (
            limits.length ? (
              limits.map((l) => <BudgetRow key={l.category} limit={l} />)
            ) : (
              <div className="empty" style={{ padding: 20 }}>
                <p>Лимиты на этот месяц не заданы</p>
                <a className="btn btn-sm" href="#budget">Задать лимиты</a>
              </div>
            )
          ) : (
            <Loading height={200} />
          )}
        </section>

        <section className="card span-4" style={{ paddingInline: 0, paddingBottom: 8 }}>
          <div className="card-head" style={{ paddingInline: 20 }}>
            <h2>Последние операции</h2>
            <a href="#transactions">Все</a>
          </div>
          {recent.data ? (
            <ul className="tx-list">
              {recent.data.map((tx) => (
                <li key={tx._id} className="tx">
                  <button type="button" className="tx-row" style={{ gridTemplateColumns: '28px minmax(0,1fr) auto', paddingBlock: 9 }} onClick={() => openEditor(tx)}>
                    <CategoryIcon name={tx.category.name} type={tx.type} small />
                    <span className="tx-main">
                      <span className="tx-title" style={{ fontSize: 14 }}>{tx.description || tx.category.name}</span>
                      <span className="tx-meta">{shortDate(tx.date)} · {tx.category.name}</span>
                    </span>
                    <span className={`tx-amount num ${tx.type}`} style={{ fontSize: 14 }}>
                      {money(tx.type === 'income' ? tx.amount : -tx.amount, { sign: true })}
                    </span>
                  </button>
                </li>
              ))}
              {!recent.data.length && <li className="empty">Операций пока нет</li>}
            </ul>
          ) : (
            <div style={{ padding: '0 20px' }}><Loading height={220} /></div>
          )}
        </section>

        <section className="card span-3">
          <div className="card-head">
            <h2>Счета</h2>
            <a href="#accounts">Все</a>
          </div>
          {accounts.map((a) => (
            <div key={a._id} className="account-mini">
              <span className="cat-icon sm" style={{ '--c': `var(--series-${a.slot})` }}>
                <Wallet size={15} />
              </span>
              <div className="grow">
                <div style={{ fontSize: 14, fontWeight: 500 }}>{a.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>{KIND[a.kind]}</div>
              </div>
              <b className="num" style={{ fontSize: 14 }}>{money(a.balance, { round: true })}</b>
            </div>
          ))}
          {s?.tags?.length > 0 && (
            <>
              <span className="eyebrow" style={{ marginTop: 4 }}>Частые теги</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {s.tags.slice(0, 6).map((t) => (
                  <a key={t.tag} className="chip" href={`#transactions`} title={`${t.count} операций на ${money(t.total)}`}>
                    #{t.tag} <span className="muted num">{t.count}</span>
                  </a>
                ))}
              </div>
            </>
          )}
          <button type="button" className="link" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center' }} onClick={() => openEditor(null)}>
            Добавить операцию <ChevronRight size={14} />
          </button>
        </section>
      </div>
    </>
  );
}
