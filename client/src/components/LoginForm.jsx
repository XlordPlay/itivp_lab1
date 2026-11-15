import { useState } from 'react';
import { getErrorMessage, login } from '../api';

export function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await login(email, password);
      localStorage.setItem('token', data.token);
      onLogin(data.token);
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <h1>Учёт личных финансов</h1>
      <form onSubmit={submit} className="login">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" required />
        <button type="submit" disabled={loading}>
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </main>
  );
}
