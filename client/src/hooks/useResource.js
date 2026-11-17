import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage, isCanceled } from '../api';

export function useResource(load, deps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    load(controller.signal)
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        if (isCanceled(err)) return;
        setError(getErrorMessage(err));
        setLoading(false);
      });
    return () => controller.abort();
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, setData, loading, error, reload };
}
