import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../context';
import { money } from '../lib/format';
import { CategoryIcon } from './CategoryIcon';

const compact = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const axisMoney = (v) => (v >= 1000 ? `${compact.format(v / 1000)} тыс.` : compact.format(v));

function CashflowTip({ active, payload, label, monthText }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="chart-tip">
      <header>
        {label} {monthText} · накопленным итогом
      </header>
      <div>
        <span className="dot" style={{ '--c': 'var(--income)' }} /> Доходы <b className="num">{money(row.income)}</b>
      </div>
      <div>
        <span className="dot" style={{ '--c': 'var(--expense)' }} /> Расходы <b className="num">{money(row.expense)}</b>
      </div>
    </div>
  );
}

// Доходы и расходы месяца накопленным итогом: одна ось, две серии, подсказка по наведению
export function CashflowChart({ daily, monthGenitive, lastDay }) {
  const { theme } = useApp();
  const c = theme.chart;
  const data = [];
  for (const d of daily) {
    if (lastDay && d.day > lastDay) break;
    const prev = data.at(-1) || { income: 0, expense: 0 };
    data.push({
      day: d.day,
      income: Math.round((prev.income + d.income) * 100) / 100,
      expense: Math.round((prev.expense + d.expense) * 100) / 100,
    });
  }

  return (
    <div style={{ width: '100%', flex: 1, minHeight: 260 }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={260}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fill-income" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.income} stopOpacity={0.18} />
              <stop offset="100%" stopColor={c.income} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fill-expense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.expense} stopOpacity={0.18} />
              <stop offset="100%" stopColor={c.expense} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={{ stroke: c.grid }}
            tick={{ fill: c.axis, fontSize: 12 }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            width={64}
            tickLine={false}
            axisLine={false}
            tick={{ fill: c.axis, fontSize: 12 }}
            tickFormatter={axisMoney}
          />
          <Tooltip
            content={<CashflowTip monthText={monthGenitive} />}
            cursor={{ stroke: c.axis, strokeWidth: 1 }}
          />
          <Area type="monotone" dataKey="income" stroke={c.income} strokeWidth={2} fill="url(#fill-income)" activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} />
          <Area type="monotone" dataKey="expense" stroke={c.expense} strokeWidth={2} fill="url(#fill-expense)" activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Расходы по категориям: ранжированные полосы одного цвета (категория — подписью и иконкой)
export function CategoryBars({ rows, total, limit = 6 }) {
  const head = rows.slice(0, limit);
  const rest = rows.slice(limit).reduce((s, r) => s + r.total, 0);
  const list = rest > 0 ? [...head, { category: 'Остальное', total: rest, icon: 'package', other: true }] : head;
  const max = Math.max(...list.map((r) => r.total), 1);

  return (
    <ul className="bars">
      {list.map((row) => (
        <li key={row.category} className="bar-row" title={`${row.category}: ${money(row.total)}`}>
          <CategoryIcon name={row.category} type="expense" icon={row.icon} small />
          <span className="label">
            {row.category}
            <span className="muted num" style={{ fontWeight: 400 }}>
              {' '}
              · {Math.round((row.total / (total || 1)) * 100)}%
            </span>
          </span>
          <span className="value num">{money(row.total)}</span>
          <span className="bar-track">
            <span style={{ width: `${(row.total / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

// Мини-столбики расходов по дням для плитки «В среднем в день»
export function DailyBars({ daily, lastDay }) {
  const days = daily.filter((d) => !lastDay || d.day <= lastDay);
  const max = Math.max(...days.map((d) => d.expense), 1);
  const w = 100 / Math.max(days.length, 1);
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" width="100%" height="36" role="img" aria-label="Расходы по дням">
      {days.map((d, i) => {
        const h = Math.max((d.expense / max) * 30, d.expense ? 1.5 : 0.6);
        return (
          <rect key={d.day} x={i * w + w * 0.15} y={32 - h} width={w * 0.7} height={h} rx={0.8} fill={d.expense ? 'var(--expense)' : 'var(--line-strong)'}>
            <title>{`${d.day}-е: ${money(d.expense)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
