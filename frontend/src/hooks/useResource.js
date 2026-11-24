import { useCallback, useEffect, useState } from 'react';

// O loader deve ser estável (useCallback ou função de módulo).
// Trocar de rota cancela a consulta e impede que uma resposta antiga substitua a atual.
export function useResource(loader) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ loader, loading: true, data: null, error: null });

  const retry = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    setState({ loader, loading: true, data: null, error: null });

    Promise.resolve()
      .then(() => loader({ signal: controller.signal }))
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ loader, loading: false, data, error: null });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({ loader, loading: false, data: null, error });
        }
      });

    return () => controller.abort();
  }, [loader, version]);

  if (state.loader !== loader) {
    return { loading: true, data: null, error: null, retry };
  }

  return { ...state, retry };
}
