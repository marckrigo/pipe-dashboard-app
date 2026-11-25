# Pipe Dashboard

A Pipefy app that shows a pipe's cards as configurable charts. It caches cards
in IndexedDB (with Dexie), fetches only updated cards when opened again, and renders
charts with Recharts. Inside Pipefy it registers a `Dashboard` pipe view;
outside Pipefy it shows an informational landing page.

Based on the official Pipefy sample app
([sample-app-react](https://github.com/Pipefyteam/sample-app-react)).

## How it works (summary)

- The Pipefy API returns at most **50 cards per request** and can only filter
  cards by `updated_at`. It cannot filter by phase or by custom fields.
- Because of that, the app loads all cards once, stores them in the browser
  (separated by user and by pipe), and computes filters and charts locally.
- After the first load, opening the dashboard only fetches what changed since the last sync.
- Architecture, decisions and limitations: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:PORT`.

The Pipefy SDK only works when the app is loaded inside Pipefy. Opening the
address directly in a browser shows the informational page (or an SDK error,
depending on the route). To use the dashboard:

1. Expose the local server through an HTTPS tunnel (for example, ngrok):
   ```sh
   ngrok http PORT --url https://YOUR-DOMAIN.ngrok-free.dev
   ```
2. Register an app at https://app.pipefy.com/developers/apps, inside the
   organization, using the development manifest URL
   (`https://YOUR-DOMAIN.ngrok-free.dev/dev/manifest.json`).
3. Enable the app, open the pipe and select the **Dashboard** view in the
   view selector.

Useful commands:

```sh
npm run typecheck
npm run build
npm run preview
```

## Hosted version

The production app is deployed on Vercel on every push to `main`:
https://pipe-dashboard-app.vercel.app

To use it, register an app in Pipefy with the manifest URL
`https://pipe-dashboard-app.vercel.app/manifest.json`, enable it and open the
pipe.

`vercel.json` sets the header that allows Pipefy to embed the app in an iframe
and rewrites routes to `index.html`.

## Production vs. development

Two apps are registered in Pipefy, each with a different origin:

|             | Manifest                   | Origin         |
| ----------- | -------------------------- | -------------- |
| Production  | `public/manifest.json`     | Vercel         |
| Development | `public/dev/manifest.json` | tunnel (ngrok) |

IndexedDB belongs to the origin, so **each app has its own cache**: loading data
in one does not fill the other. To demo the app, load the data in the app you
will present, using the same Pipefy user.

## Technologies

- [React](https://react.dev/) and React DOM for the UI;
- [react-router-dom](https://reactrouter.com/) for routes;
- [Vite](https://vitejs.dev/guide/) for local development and production builds;
- [TypeScript](https://www.typescriptlang.org/) for type checking;
- [Dexie](https://dexie.org/) for IndexedDB caching;
- [Recharts](https://recharts.org/) for the charts;
- TypeScript and Prettier for type checking and formatting;
- Pipefy App SDK, loaded from `index.html`, for `initCall` and authenticated
  GraphQL queries.

Pipefy developer documentation: https://developers.pipefy.com

## File descriptions

### [src/index.tsx](src/index.tsx)

Creates the React root, registers routes and wraps the app with the Pipefy App
provider. `index.html` is required because it loads the Pipefy SDK and mounts
this file.

### [src/routes/main.tsx](src/routes/main.tsx)

Registers the pipe-view feature inside Pipefy. Outside Pipefy, it renders the
informational landing page from `src/components/landing-page.tsx`.

### [src/routes/pipe-dashboard.tsx](src/routes/pipe-dashboard.tsx)

The dashboard screen: chart type, grouping field, filters, loading overlays and
the chart panel. Filters are applied only when the user clicks **Aplicar
filtros**.

### [src/components/dashboard-chart.tsx](src/components/dashboard-chart.tsx)

Isolated Recharts component shared by bar, line, area and pie charts.

### [src/hooks/use-cards-sync.ts](src/hooks/use-cards-sync.ts)

Connects React to the cache and sync layers. Decides between a full load and an
incremental sync, and exposes progress to the UI.

### [src/data/sync-cards.ts](src/data/sync-cards.ts)

Implements `loadAll` and `syncIncremental`. The first load pages through
`allCards` 50 cards at a time; later opens ask only for cards updated after the
stored `lastSyncAt` timestamp.

### [src/cache/db.ts](src/cache/db.ts)

Dexie database `pipe-dashboard`. Stores cards and sync metadata, including the
pagination cursor needed to resume an interrupted first load. Keys include the
user and pipe IDs, so users do not see each other's data.

### [src/api/cards.ts](src/api/cards.ts)

GraphQL queries for cards and pipe counters, including pagination, retry and the
incremental `updated_at` filter.
