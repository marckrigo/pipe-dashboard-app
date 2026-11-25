import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { PipefyAppProvider } from './contexts/pipefy-app-context';
import { Main, PipeDashboard } from './routes';

import './styles/index.css';

const basename = window.location.pathname.startsWith('/dev') ? '/dev' : '/';

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Main />,
    },
    {
      path: '/pipe-dashboard',
      element: <PipeDashboard />,
    },
  ],
  {
    basename,
  },
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PipefyAppProvider>
      <RouterProvider router={router} />
    </PipefyAppProvider>
  </React.StrictMode>,
);
