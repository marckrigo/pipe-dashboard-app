import { useEffect } from 'react';
import { LandingPage } from '../components/landing-page';
import { usePipefyApp } from '../hooks/use-pipefy-app';

export function Main() {
  const { pipefyApp, ready } = usePipefyApp();

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

  // Render nothing inside Pipefy, where the feature is registered in the effect; outside, show the landing page.
  if (!ready || pipefyApp) {
    return <div />;
  }

  return <LandingPage />;
}
