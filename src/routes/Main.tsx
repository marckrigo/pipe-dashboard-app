import { useEffect } from 'react';
import { usePipefyApp } from '../hooks/usePipefyApp';

export function Main() {
  const { pipefyApp } = usePipefyApp();

  useEffect(() => {
    if (pipefyApp) {
      pipefyApp.initCall({
        /**
         * This object defines all of the features your app will create inside Pipefy.
         * Check the documentation for more details on which features are available:
         * https://developers.pipefy.com/docs/features
         */

        'pipe-view': function () {
          return {
            icon: './pfy.png',
            text: 'Dashboard',
            url: 'pipe-dashboard',
          };
        },
      });
    }
  }, [pipefyApp]);

  return <div />;
}
