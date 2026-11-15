import { useState } from 'react';
import { getErrorMessage, login, register } from '../api';

const LEDGER = [
  ['Капучино', '6,00'],
  ['Евроопт, 7 позиций', '43,18'],
  ['Проездной', '63,00'],
  ['Зарплата', '+2 650,00'],
];

export function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'register') await register(email, password);
      const { token } = await login(email, password);
      localStorage.setItem('token', token);
      onLogin(token, email);
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <main className="auth">
      <section className="auth-art">
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark" style={{ background: 'var(--inverse-ink)', color: 'var(--inverse)' }}>С</span>
          сальдо
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h1>Каждый рубль на своём месте</h1>
          <p>Операции, чеки, счета и бюджет в одном месте. Ассистент считает траты и записывает покупки по одной фразе.</p>
        </div>
        <div className="ledger-lines" aria-hidden="true">
          {LEDGER.map(([name, value]) => (
            <div key={name}>
              <span>{name}</span>
              <span />
              <b>{value} Br</b>
            </div>
          ))}
        </div>
      </section>

      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <div className="segmented" role="group" aria-label="Режим" style={{ alignSelf: 'flex-start' }}>
            <button type="button" aria-pressed={mode === 'login'} onClick={() => setMode('login')}>Вход</button>
            <button type="button" aria-pressed={mode === 'register'} onClick={() => setMode('register')}>Регистрация</button>
          </div>
          <h2>{mode === 'login' ? 'С возвращением' : 'Новый аккаунт'}</h2>
          <label className="field">
            <span>Email</span>
            <input id="login-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label className="field">
            <span>Пароль</span>
            <input id="login-password" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </label>
          {mode === 'register' && <p className="muted" style={{ fontSize: 13 }}>Не короче 8 символов, с заглавной буквой, цифрой и спецсимволом.</p>}
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn btn-primary" style={{ height: 44 }} disabled={loading}>
            {loading ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
          <p className="demo-hint">
            Демо-аккаунт с данными: <code>student@finance.by</code> / <code>Finance2026!</code>
          </p>
        </form>
      </section>
    </main>
  );
}
