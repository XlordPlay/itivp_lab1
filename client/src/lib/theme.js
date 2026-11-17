import { useEffect, useState } from 'react';

export const CHART = {
  light: {
    income: '#2a78d6',
    expense: '#eb6834',
    grid: '#e1e0d9',
    axis: '#898781',
    surface: '#fcfcfb',
  },
  dark: {
    income: '#3987e5',
    expense: '#d95926',
    grid: '#2c2c2a',
    axis: '#898781',
    surface: '#1a1a19',
  },
};

const KEY = 'saldo-theme';

function readStored() {
  try {
    return localStorage.getItem(KEY) || 'system';
  } catch {
    return 'system';
  }
}

export function useTheme() {
  const [mode, setMode] = useState(readStored);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystemDark(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
    try {
      localStorage.setItem(KEY, mode);
    } catch {
    }
  }, [mode]);

  const resolved = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
  const toggle = () => setMode(resolved === 'dark' ? 'light' : 'dark');
  return { mode, resolved, toggle, chart: CHART[resolved] };
}
