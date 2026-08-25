# Vela Motors

A working electric-car storefront: browse the range, filter live inventory, configure a
vehicle with prices that update as you choose, and place an order through a validated
checkout. Built as a single-page React app with no backend — the catalogue, the inventory
and the pricing engine all run in the browser.

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # typecheck + production bundle
npm run shot       # Playwright captures into .shots/ (see tools/shot.mjs --list)
```

## The funnel

| Route | What it does |
| --- | --- |
| `/` | Full-viewport, scroll-snapped section per model, each with the vehicle, its headline numbers and the order/demo actions. |
| `/inventory` | 84 deterministic vehicles with a filter rail (model, condition, trim, paint, wheels, price, range), sorting, URL-synced state, skeleton loading and an empty state that clears itself. |
| `/design/:modelId` | The configurator: trim, paint, wheels, interior, seating, autonomy package and accessories, with the render and the price responding to every choice. |
| `/checkout` | Vehicle summary, payment mode, contact, registration and card details with per-field validation, then a confirmation page with the order number and delivery window. |
| `/lab/cars` | Internal bake-off stage that renders competing vehicle drawings side by side. |

## How it is put together

```
src/
  components/       chrome (Header, Footer, RootLayout), ui/ kit, car/ vehicle render
  data/             models.ts (catalogue) · inventory.ts (seeded generator)
  lib/              pricing.ts · format.ts · validation.ts · storage.ts
  pages/            home · inventory · design · checkout · lab
  store/            OrderContext — the configuration, payment mode and ZIP, persisted
  styles/           tokens.css (the only source of colour, type and spacing values)
```

- **Pricing** lives in `src/lib/pricing.ts`: option deltas, destination and order fees, the
  federal incentive, a 72-month loan at 5.49% APR and a 36-month lease at a 55% residual.
- **Inventory** is generated from a fixed seed, so the same 84 cars appear on every load and
  in every screenshot.
- **The vehicle** is inline SVG (`src/components/car/CarRender.tsx`) whose paint, wheels and
  view are driven by props, which is why colour changes cross-fade instead of swapping images.
- **No CSS framework.** Every value comes from the custom properties in `src/styles/tokens.css`.

## How it was built

`docs/reference-spec.md` states the benchmark — the Tesla purchase funnel — as measurable
properties. `docs/ui-contract.md` fixes the component signatures so parallel agents could
build against each other. Each piece of the interface (hero, scroll, grid, filters, render,
options, price, loading, checkout, mobile) then went through builder/critic rounds: a builder
made the change and captured it with `tools/shot.mjs`, and a separate critic with no build
context scored the capture against the benchmark and named the single largest remaining gap.
`tools/progress.mjs` renders those verdicts into a live build sheet.
