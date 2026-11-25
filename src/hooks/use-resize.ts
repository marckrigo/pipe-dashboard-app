import { useEffect } from 'react';
import type { PipefyApp } from '../types/pipefy';

export function useResize(pipefyApp: PipefyApp | null) {
  useEffect(() => {
    if (pipefyApp) {
      pipefyApp.resizeTo('#root');
    }
  }, [pipefyApp]);
}
