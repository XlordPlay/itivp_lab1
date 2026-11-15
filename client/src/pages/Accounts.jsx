import { useState } from 'react';
import { Banknote, CreditCard, PiggyBank, Plus, Trash2 } from 'lucide-react';
import { addAccount, deleteAccount, getErrorMessage, updateAccount } from '../api';
import { useApp } from '../context';
import { money, plural } from '../lib/format';

const KINDS = {
  card: { label: 'Карта', Icon: CreditCard },
  cash: { label: 'Наличные', Icon: Banknote },
  savings: { label: 'Накопления', Icon: PiggyBank },
};

function AccountCard({ account }) {
  const { toast, reloadAccounts, bumpData } = useApp();
  const [name, setName] = useState(account.name);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const kind = KINDS[account.kind];

  async function rename() {
    if (!name.trim() || name === account.name) return setName(account.name);
    try {
      await updateAccount(account._id, { name: name.trim() });
      toast('Название счёта обновлено');
      reloadAccounts();
    } catch (err) {
      setName(account.name);
      toast(getErrorMessage(err), 'error');
    }
  }

  // Каскадное удаление: сервер удаляет счёт и все его операции
  async function remove() {
    setBusy(true);
    try {
      const { removedTransactions } = await deleteAccount(account._id);
      toast(`Счёт удалён вместе с ${removedTransactions} ${plural(removedTransactions, 'операцией', 'операциями', 'операциями')}`);
      reloadAccounts();
      bumpData();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
      setBusy(false);
    }
  }

  return (
    <section className="card account-card" style={{ '--c': `var(--series-${account.slot})` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="cat-icon"><kind.Icon size={18} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <input
            id={`account-name-${account._id}`}
            className="input"
            style={{ height: 32, border: '1px solid transparent', padding: '0 6px', marginLeft: -6, fontWeight: 600, background: 'transparent' }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            aria-label="Название счёта"
          />
          <div className="muted" style={{ fontSize: 13 }}>{kind.label}</div>
        </div>
      </div>
      <div>
        <div className="eyebrow">Баланс</div>
        <div className="stat-value num">{money(account.balance)}</div>
        <div className="muted num" style={{ fontSize: 13 }}>
          начальный {money(account.initialBalance, { round: true })} · {account.count} {plural(account.count, 'операция', 'операции', 'операций')}
        </div>
      </div>
      {confirming ? (
        <div className="error-block" style={{ padding: 12, gap: 8 }}>
          <span style={{ fontSize: 14 }}>
            Удалить счёт и {account.count} {plural(account.count, 'операцию', 'операции', 'операций')}? Отменить это нельзя.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-sm btn-danger" onClick={remove} disabled={busy}>Удалить</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirming(false)}>Отмена</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-sm btn-ghost btn-danger" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirming(true)}>
          <Trash2 size={14} /> Удалить счёт
        </button>
      )}
    </section>
  );
}

export function Accounts() {
  const { accounts, toast, reloadAccounts } = useApp();
  const [form, setForm] = useState({ name: '', kind: 'card', initialBalance: '' });

  async function create(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    try {
      await addAccount({
        name: form.name.trim(),
        kind: form.kind,
        initialBalance: Number(String(form.initialBalance).replace(',', '.')) || 0,
        slot: (accounts.length % 8) + 1,
      });
      toast(`Счёт «${form.name.trim()}» создан`);
      setForm({ name: '', kind: 'card', initialBalance: '' });
      reloadAccounts();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  }

  const total = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <>
      <section className="card hero" style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="eyebrow">Всего на счетах</span>
          <span className="hero-value num">{money(total)}</span>
        </div>
        <span style={{ color: 'var(--inverse-muted)' }}>
          {accounts.length} {plural(accounts.length, 'счёт', 'счёта', 'счетов')} · баланс = начальный остаток + доходы − расходы
        </span>
      </section>

      <div className="accounts">
        {accounts.map((a) => (
          <AccountCard key={`${a._id}-${a.name}`} account={a} />
        ))}

        <form className="card" onSubmit={create} style={{ boxShadow: 'none', border: '1px dashed var(--line-strong)', background: 'transparent' }}>
          <h2 style={{ fontSize: 16 }}>Новый счёт</h2>
          <label className="field">
            <span>Название</span>
            <input id="account-new-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Например, «Карта для путешествий»" />
          </label>
          <div className="form-row">
            <label className="field">
              <span>Тип</span>
              <select id="account-new-kind" className="select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {Object.entries(KINDS).map(([value, k]) => (
                  <option key={value} value={value}>{k.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Остаток, Br</span>
              <input id="account-new-balance" className="input num" value={form.initialBalance} onChange={(e) => setForm({ ...form, initialBalance: e.target.value })} placeholder="0" inputMode="decimal" />
            </label>
          </div>
          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
            <Plus size={16} /> Создать счёт
          </button>
        </form>
      </div>
    </>
  );
}
