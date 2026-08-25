# Reference spec — the funnel we are matching

The benchmark is the Tesla purchase funnel: the marketing home page, the inventory
listing, the Model 3 configurator and its checkout. Live capture of tesla.com is not
available from this build environment (their edge blocks it, and the archive host is
blocked by egress policy), so this file is the yardstick: concrete, measurable
properties of that funnel. Builders build to it; critics score against it.

## Global system

**Type.** One neutral grotesque, weights 400/500 only for UI, 500 for headings.
Display headline 40px mobile / 56px desktop, line-height ≈ 1.05, tracking −0.02em.
Section heading 32–44px. Body 14–16px, `--text-secondary` for anything supporting.
Legal/disclaimer 12px. Never bold-face a heading past 500 — weight is not how this
brand gets emphasis; scale and space are.

**Colour.** Near-black `#171a20` for text and dark chrome, white page, `#f4f4f4`
surfaces, a single blue `#3e6ae1` reserved for the primary action and links. No
gradients on chrome, no coloured shadows, no accent colours beyond the one blue.

**Buttons.** Pill, 40px tall (48 on `lg`), min-width 260px in hero contexts,
14px/500 with 0.05em tracking. Over imagery they are translucent chips — light
`rgba(244,244,244,.65)` with dark text, dark `rgba(23,26,32,.8)` with white text —
which solidify on hover in 140ms. On white surfaces the primary is solid blue.

**Header.** Fixed, 56px tall, logo/wordmark left, model links centre, account links
right. Transparent over hero imagery, with the link colour flipping to white when the
section behind it is dark; solid white with a hairline once you leave the hero.
Hover shows a soft rounded backdrop behind the link, not an underline. Under 1200px
the centre links collapse into a "Menu" affordance that opens a right-side drawer.

**Motion.** Everything is 140–420ms on an ease-out curve. Nothing bounces, nothing
overshoots, nothing loops. Paint changes cross-fade, prices roll, panels slide.
`prefers-reduced-motion` kills all of it.

## Home

Full-viewport sections, one per model, that snap as you scroll. Each section:
the vehicle centred and large, the model name in display type near the top, a single
supporting line under it (a price-per-month or a claim), and two pill CTAs centred
near the bottom — primary "Order Now", secondary "Demo Drive". Small print sits
directly under the CTAs at 12px. A scroll chevron on the first section only,
animating a short 8px bob.

Rules that decide whether this reads as premium or as a template:
- The car is the subject: it occupies 55–70% of the section width on desktop and is
  vertically centred in the remaining space between headline and CTAs.
- Text sits over the image, never in a box, never in a card, never left-aligned in a
  half-width column.
- The section fills exactly 100dvh — no partial next-section peeking except a
  deliberate chevron.
- Scrolling one notch moves exactly one section. No inertial drift into a half state.
- The footer appears only after the last section, as a single row of small links.

## Inventory listing

Two-column: a persistent filter rail (~280px) on the left, results right. Header row
above the results with the count ("42 results"), a location line, and a sort select.
Cards are 3-up at ≥1200px, 2-up ≥768px, 1-up below, with a 24px gutter and no visible
card border — separation comes from whitespace and the image plate.

Card content order: vehicle image on a light plate, title (`2026 Vela 3`), trim line,
then a price block where the purchase price is the large number and the monthly
estimate sits beneath it in secondary text, then a three-item spec row
(range / 0-60 / drive), then location + delivery window, then a full-width button.
Condition badges ("Demo", "Used") sit on the image plate, top-left, 12px, uppercase.

Filters: paint and wheels as swatch grids, trim/condition as checkbox rows, price
and range as sliders with live value labels, everything reflected in the URL so the
view is shareable, everything resettable from a single "Reset" affordance that only
appears when a filter is active. Result count updates as filters change, and the grid
cross-fades rather than blinking.

Loading: skeleton cards with the exact geometry of the real cards — same plate
aspect, same line lengths — shimmering once, never a spinner. Empty state: a short
sentence, the active filters listed, and a button that clears them.

## Configurator

Two-column at ≥1024px: the render column takes ~62% and is sticky; the option panel
takes the rest and scrolls. Under 1024px the render pins to the top at ~45vh and the
options scroll beneath it, with a fixed summary bar at the bottom.

The render column is a light studio plate. The car is centred, large, and changes with
every selection: paint cross-fades over ~400ms, wheels swap, and nothing else moves.
A thumbnail/angle row sits under the car; the currently-priced summary never overlaps
the car.

The option panel is a stack of sections in this order: trim, paint, wheels, interior,
seating (when the model offers it), autonomy package, accessories. Each section has a
32px heading, an option group, and — critically — the selected option's name and price
delta echoed under the group, plus a one-line description of what the selection does.
Trims are full-width rows showing name, range, 0-60, top speed and the price delta.
Paint and wheels are swatch/thumbnail rows with the name and delta under the active
one. Add-ons are cards with a checkbox affordance, a short summary and a bullet list.

Price: a persistent summary showing the payment mode toggle (Cash / Finance / Lease),
the headline number for that mode, and an expandable breakdown listing every line item
with its amount, the destination fee, the order fee and the incentive as a negative
line. The headline number animates between values — digits roll, they do not jump —
and the estimate disclaimer sits under it at 12px. "Order Now" is fixed to the bottom
of the panel on desktop and to the viewport on mobile; it never scrolls out of reach.

## Checkout

Single column, max ~720px, centred, with the order summary as a sticky right rail at
≥1024px and a collapsible summary at the top on mobile. Sections in order: your
vehicle (thumbnail + config lines + price), payment method, contact details,
registration address, then the order agreement and the place-order button.

Fields are 56px tall with floating labels, 4px radius, hairline borders that turn blue
on focus. Errors appear under the field in 12px red on blur and on submit — never as a
browser alert, never as a red flash of the whole form. The submit button shows a
spinner in place of its label while the order posts, then the route changes to a
confirmation page that states the order number, what happens next, and the delivery
window. The card number field formats in groups of four as you type; the expiry field
inserts its slash.

## What "ours wins" means

A critic comparing our capture to that funnel decides which one a shopper would trust
with a $50,000 purchase. Ours wins only when the answer is not "the other one, because
it looks more expensive". Praise is worthless — every round must name the single
largest remaining gap, concretely enough to fix in one pass.
