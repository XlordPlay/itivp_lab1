import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { money } from '../lib/format';
import { CategoryIcon } from './CategoryIcon';

export function budgetStatus(spent, limit) {
  const ratio = limit > 0 ? spent / limit : spent > 0 ? 2 : 0;
  if (ratio > 1) return { key: 'critical', label: 'Превышен', Icon: CircleAlert, ratio };
  if (ratio >= 0.8) return { key: 'warning', label: 'Почти исчерпан', Icon: TriangleAlert, ratio };
  return { key: 'good', label: 'В пределах', Icon: CircleCheck, ratio };
}

export function BudgetRow({ limit, children }) {
  const status = budgetStatus(limit.spent, limit.limit);
  const left = limit.limit - limit.spent;
  return (
    <div className="budget-row">
      <CategoryIcon name={limit.category} type="expense" />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500 }}>{limit.category}</div>
        <div className="muted num" style={{ fontSize: 13 }}>
          {money(limit.spent)} из {money(limit.limit, { round: true })}
          {' · '}
          {left >= 0 ? `осталось ${money(left)}` : `сверх лимита ${money(-left)}`}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className={`status ${status.key}`}>
          <status.Icon size={14} /> {status.label}
        </span>
        {children}
      </div>
      <div className="progress" data-status={status.key} role="progressbar" aria-valuenow={Math.round(status.ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${limit.category}: ${Math.round(status.ratio * 100)}% лимита`}>
        <span style={{ width: `${Math.min(status.ratio, 1) * 100}%` }} />
      </div>
    </div>
  );
}
