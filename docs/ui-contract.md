# Vela Motors — build contract

Everything below is fixed. Build against these signatures exactly; other agents are
writing the other half of the app in parallel and will import them as written.

## Stack
Vite + React 19 + TypeScript, React Router 7 (`react-router-dom`), plain CSS files
imported per component (`import './Header.css'`). No CSS framework, no CSS-in-JS.
Alias `@/` → `src/`. Design tokens live in `src/styles/tokens.css` — use the CSS
variables, never hard-coded hex values (except inside the car SVG, which is
paint-driven).

## Existing modules (do not rewrite)
- `src/types.ts` — domain types.
- `src/data/models.ts` — `MODELS`, `MODEL_BY_ID`, `getModel(id)`, `defaultConfig(modelId)`.
- `src/data/inventory.ts` — `INVENTORY: InventoryVehicle[]`, `buildInventory()`, `vehicleTitle(v)`.
- `src/lib/pricing.ts` — `priceConfig(config)`, `resolveConfig(config)`, `effectiveRange(config)`,
  `monthlyPayment(principal, apr, months)`, plus fee/incentive constants.
- `src/lib/format.ts` — `money`, `moneyCents`, `num`, `signedMoney`, `miles`, `monthly`.
- `src/store/OrderContext.tsx` — `<OrderProvider>` and `useOrder()`:
  `{ config, paymentMode, zip, inventoryId, setConfig, patchConfig, toggleAddOn,
     startModel, setPaymentMode, setZip, setInventoryId, price, resolved, reset }`.
- `src/router.tsx` — routes `/`, `/inventory`, `/design/:modelId`, `/checkout`,
  `/order/:orderId`, `*`.

## Component contract

### `src/components/RootLayout.tsx` (default export)
Wraps `<OrderProvider>`, renders `<Header />`, `<Outlet />`, `<Footer />` and a
route-change scroll reset. Header is fixed; pages that need a transparent header
set `data-header="transparent"` on their root element — Header reads it via a
`useHeaderTheme()` hook exported from `src/components/Header.tsx`, or via
`document` observation. Home is transparent-over-hero, all other pages solid.

### `src/components/ui/Button.tsx`
```ts
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'onImageLight' | 'onImageDark' | 'text';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  to?: string;      // when set, renders a react-router <Link> styled as the button
  loading?: boolean;
}
export default function Button(props: ButtonProps): React.ReactElement;
```
Pill radius (`--r-pill`), 40px tall at `md`, 48px at `lg`, uppercase-free sentence
case, letter-spacing `0.05em`, font-size 14px, weight 500. `onImageLight` is the
translucent light chip used over photography; `onImageDark` is the dark one.

### `src/components/ui/Skeleton.tsx`
```ts
export function Skeleton(props: { w?: string | number; h?: string | number; radius?: string; className?: string }): React.ReactElement;
```
Shimmer via CSS keyframes; respects `prefers-reduced-motion`.

### `src/components/ui/Sheet.tsx`
```ts
export interface SheetProps { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; side?: 'bottom' | 'right'; }
```
Bottom sheet on mobile, right drawer ≥ 768px. Focus trap, `Esc` to close, scroll lock,
backdrop fade, spring-free `--ease-out` transform transition.

### `src/components/ui/Field.tsx`
```ts
export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string; error?: string; hint?: string; suffix?: React.ReactNode;
}
```
Floating-label input: label sits inside the 56px-tall field and rises on focus/fill.

### `src/components/car/CarRender.tsx`
```ts
export interface CarRenderProps {
  body: BodyStyle;             // 'sedan' | 'suv'
  paint: PaintOption;
  wheel: WheelOption;
  view?: 'front-3q' | 'side';  // default 'front-3q'
  ground?: boolean;            // shadow + floor reflection, default true
  className?: string;
  label?: string;              // aria-label
}
export default function CarRender(props: CarRenderProps): React.ReactElement;
```
Pure inline SVG with a `viewBox`, `width: 100%`, `height: auto`. Body paint comes
from `paint.hex / paint.sheen / paint.shade` through gradients, and every paint-driven
`fill`/`stop-color` transitions over `--dur-slow` so a colour change animates.
Wheels switch on `wheel.style` (`aero | sport | turbine | arachnid`) and scale with
`wheel.size`. Never ship a placeholder box — this is the product photography.

## Required `data-testid` hooks
`menu-toggle`, `filter-toggle`, `paint-<paintId>`, `wheel-<wheelId>`,
`trim-<trimId>`, `place-order`, `vehicle-card`, `price-total`.

## Quality bar
Desktop 1440×900 and mobile 390×844 both matter. Keyboard reachable, visible focus,
`prefers-reduced-motion` respected, no console errors, no layout shift on load,
`npm run build` clean.
