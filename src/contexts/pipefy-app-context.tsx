import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PipefyApp, PipefyAppInstance } from '../types/pipefy';

type PipefyAppContextValue = {
  pipefyApp: PipefyApp | null;
  pipefyAppInstance: PipefyAppInstance | null;
  userId: string | null;
  pipeId: string | null;
  ready: boolean;
};

export const PipefyAppContext = createContext<PipefyAppContextValue>({
  pipefyApp: null,
  pipefyAppInstance: null,
  userId: null,
  pipeId: null,
  ready: false,
});

export const PipefyAppProvider = ({ children }: { children: ReactNode }) => {
  const [pipefyApp, setPipefyApp] = useState<PipefyApp | null>(null);
  const [pipefyAppInstance, setPipefyAppInstance] = useState<PipefyAppInstance | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [pipeId, setPipeId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        if (window.PipefyApp && window.PipefyApp.init) {
          const instance = window.PipefyApp.init();
          setPipefyAppInstance(instance);
          setPipefyApp(window.PipefyApp);

          // p.pipeId may be a short id on some surfaces; GraphQL needs p.app.pipeId.
          if (!cancelled) {
            const contextPipeId = instance.app?.pipeId;
            setPipeId(contextPipeId ? String(contextPipeId) : null);
          }

          // The cache is scoped per authenticated user; without an id there is no valid scope.
          const result = await instance.query<{ me: { id: string } | null }>('{ me { id } }');
          const id = result?.data?.me?.id;
          if (!id) {
            throw new Error('Não foi possível identificar o usuário autenticado no Pipefy');
          }
          if (!cancelled) {
            setUserId(String(id));
          }
        }
      } catch (error) {
        console.error('[pipe-dashboard] falha ao identificar usuário', error);
      } finally {
        // Only after this check can we tell whether the app runs inside or outside Pipefy.
        if (!cancelled) {
          setReady(true);
        }
      }
    };

    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => {
    return { pipefyApp, pipefyAppInstance, userId, pipeId, ready };
  }, [pipefyApp, pipefyAppInstance, userId, pipeId, ready]);

  return <PipefyAppContext.Provider value={value}>{children}</PipefyAppContext.Provider>;
};
