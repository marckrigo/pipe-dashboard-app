import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PipefyApp, PipefyAppInstance } from '../types/pipefy';

type PipefyAppContextValue = {
  pipefyApp: PipefyApp | null;
  pipefyAppInstance: PipefyAppInstance | null;
};

export const PipefyAppContext = createContext<PipefyAppContextValue>({
  pipefyApp: null,
  pipefyAppInstance: null,
});

export const PipefyAppProvider = ({ children }: { children: ReactNode }) => {
  const [pipefyApp, setPipefyApp] = useState<PipefyApp | null>(null);
  const [pipefyAppInstance, setPipefyAppInstance] = useState<PipefyAppInstance | null>(null);

  useEffect(() => {
    try {
      if (window.PipefyApp && window.PipefyApp.init) {
        setPipefyAppInstance(window.PipefyApp.init());
        setPipefyApp(window.PipefyApp);
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  const value = useMemo(() => {
    return { pipefyApp, pipefyAppInstance };
  }, [pipefyApp, pipefyAppInstance]);

  return <PipefyAppContext.Provider value={value}>{children}</PipefyAppContext.Provider>;
};
