# Skyline Hub — frontend

The web app for the **Skyline Student Association**: memberships with QR cards, ticketed events,
door check-in, merch with per-size stock, fundraisers with task boards, expense claims with
receipts, and a treasurer's ledger with CSV exports.

React 18 · Vite · TypeScript (strict) · Tailwind + shadcn-style primitives · TanStack Query ·
Axios · React Hook Form + zod · Recharts · @dnd-kit · html5-qrcode · date-fns · sonner.

> **This folder is the whole app.** There is no backend folder and nothing else to install.
> Out of the box it runs against an in-browser mock API, so every screen is fully clickable
> with realistic seeded data — no server, no localhost:8000, no network at all.

---

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | `tsc --noEmit && vite build` → static bundle in `dist/` |
| `npm run preview` | Serves the production build on :4173 |
| `npm run typecheck` | Types only |
| `npm run smoke` | 104-check end-to-end suite against the mock API, headless |
| `npm run smoke:render` | Server-renders every route/page (39 pages) to catch broken imports |
| `npm run smoke:dom` | Boots the real app in jsdom, signs in as each role, asserts seeded data renders |

All three suites are expected to exit 0.

## Demo accounts

| Role | Email | Password | What they can reach |
| --- | --- | --- | --- |
| Admin (President) | `admin@skyline.edu` | `admin123` | everything |
| Treasurer | `treasurer@skyline.edu` | `treasurer123` | money, member roll, everything except nothing |
| Volunteer | `volunteer@skyline.edu` | `volunteer123` | check-in, verify, fundraisers, their tasks |
| Member | `member@skyline.edu` | `member123` | card, tickets, orders, claims |
| Seeded members | any `*@skyline.edu` in the member roll | `skyline123` | — |

The login screen lists the four demo accounts with one-click fill buttons. Visitors can buy a
membership, a ticket or merch without signing in (guest checkout).

Useful demo state: Spring Gala has **80 of 200 seats left**, the bake sale fundraiser is
**AT RISK** with overdue tasks, the hoodie's M size has 4 left and XXL is **sold out**, and the
expense queue holds one claim per status (SUBMITTED, APPROVED, REJECTED, REIMBURSED).

## Mock mode vs the real API

`.env` (already committed):

```
VITE_API_URL=http://localhost:8000/api
VITE_USE_MOCKS=true
```

* `VITE_USE_MOCKS=true` — a custom **axios adapter** serves every endpoint from a seeded database
  in `localStorage`. No service worker, no fetch interception, nothing to install.
* `VITE_USE_MOCKS=false` — the exact same API modules hit `VITE_API_URL` with a bearer token.
  **No component or API-module change is needed**; only this flag. If the API is unreachable the
  shell shows a "Can't reach the API" card with a retry button instead of a blank screen.

Mock data is versioned and self-healing: change the shape, bump `DB_VERSION` in
`src/api/mock/db.ts`, and the seed rebuilds. "Reset demo data" lives in the user menu and on the
profile page (it clears `skyline_mock_db_v2` and reloads).

Realistic touches you can rely on while the backend is being written: 120–350 ms latency, base64url
JWT-shaped tokens in `localStorage` (`skyline_token`), `{ detail }` error bodies, 401/403/404/409s
that the UI already handles, and mutation-driven ledger rows (dues, tickets, merch, reimbursements,
fundraiser income).

## Layout

```
src/
  api/            axios client + one module per domain (frozen contract in types.ts)
    mock/         db seed · ops · handlers · adapter · index
  components/
    ui/           button, card, dialog, select, tabs, table, sheet, tooltip, … (shadcn-style)
    layout/       public + dashboard shells, sidebar, topbar, route guards
    shared/       PageHeader, StatCard, EmptyState, StatusBadges, QRCodeView, QRScanner, …
    charts/       IncomeDonut, MonthlyBars, RevenueArea (Recharts)
  context/        AuthContext (me + token lifecycle), ThemeContext (light/dark)
  hooks/          useDebounce, useMediaQuery, useCart (localStorage-backed)
  lib/            formatters + brand constants
  pages/
    public/       Home, Events, EventDetail, Announcements, Store, ProductDetail, Membership,
                  Login, Signup, Checkout, TicketSuccess, Unsubscribe, NotFound
    dashboard/    25 pages from AdminDashboard and Members through the fundraiser board,
                  expense queue, finance, ledger and the printable report
```

Routing lives in `src/App.tsx`: a public shell, a protected `/app/*` shell, and role guards
(`ADMIN | TREASURER | VOLUNTEER` for check-in/verify/fundraisers, `ADMIN | TREASURER` for the
member roll, money and everything else). Guards render inside the dashboard shell, so a 403 is a
friendly card, never a dead end.

## Design system

Primary `#714B67` (hover `#5C3C54`), accent `#F5B93A`, Inter with system fallback, soft-shadowed
cards, 4/8/12/20px spacing rhythm, dark mode throughout, and every status colour-coded
(active/expiring/expired memberships, order and expense states, fundraiser health, stock levels).
No external font, image or CDN requests — QR codes are generated client-side, receipt images are
inlined data URLs, and the logo is inline SVG, so the app renders identically offline or inside a
sandboxed preview frame.

## Notes for the next person

* `src/api/types.ts` is the contract. If the FastAPI backend disagrees, change it in one place and
  TypeScript will point at every caller.
* Every mutation invalidates the query keys it affects, so the dashboard, ledger and progress bars
  stay in sync without manual refreshes.
* Print styles: `/app/finance/report` is built for `window.print()` (`no-print` / `print-block`).
* Accessibility: labels on every field, `aria-label` on icon-only buttons, focus-visible rings,
  keyboard-navigable drag-and-drop (`@dnd-kit` keyboard sensor), and live regions for scanner and
  check-in results.
