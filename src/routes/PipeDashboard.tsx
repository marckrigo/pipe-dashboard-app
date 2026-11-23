import { useEffect } from 'react';
import { usePipefyApp } from '../hooks/usePipefyApp';

import '../styles/pipe-dashboard.css';

export function PipeDashboard() {
  const { pipefyApp, pipefyAppInstance } = usePipefyApp();

  useEffect(() => {
    if (pipefyApp && pipefyAppInstance) {
      /**
       * Pipefy's main application requires that Pipe Views call this method when the page load is complete
       * before rendering the tab where your application will be shown.
       * Without this, you'll be redirected to the Kanban main view.
       */
      pipefyApp.render(() => {});
    }
  }, [pipefyApp, pipefyAppInstance]);

  return (
    <div className="pipe-dashboard-content">
      <h1>Dashboard</h1>
      <p>Acompanhe os cards do pipe em gráficos personalizáveis.</p>
      <iframe src="https://app.pipefy.com/public/form/x6yC3ZCF?internal=sampleapps" />
    </div>
  );
}
