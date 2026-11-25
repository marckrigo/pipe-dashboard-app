import { useContext } from 'react';
import { PipefyAppContext } from '../contexts/pipefy-app-context';

export const usePipefyApp = () => {
  const context = useContext(PipefyAppContext);

  if (!context) {
    throw new Error('usePipefyApp must be used within a PipefyAppProvider');
  }

  return {
    pipefyApp: context.pipefyApp,
    pipefyAppInstance: context.pipefyAppInstance,
    userId: context.userId,
    pipeId: context.pipeId,
    ready: context.ready,
  };
};
