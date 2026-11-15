import { useEffect, useState } from 'react';
import { LOGOUT_EVENT } from './api';
import { LoginForm } from './components/LoginForm';
import { TransactionList } from './components/TransactionList';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  // api.js сообщает о 401, тогда возвращаемся к форме входа
  useEffect(() => {
    const onLogout = () => setToken(null);
    window.addEventListener(LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(LOGOUT_EVENT, onLogout);
  }, []);

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
  }

  return token ? <TransactionList onLogout={logout} /> : <LoginForm onLogin={setToken} />;
}
