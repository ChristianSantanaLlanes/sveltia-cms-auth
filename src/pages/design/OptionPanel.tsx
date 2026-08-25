import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { RimDefs, Wheel } from '@/components/car/rims';
import { money, num, signedMoney } from '@/lib/format';
import { useOrder } from '@/store/OrderContext';
import type { AddOnOption, InteriorOption, PaintOption, SeatingOption, Trim, WheelOption } from '@/types';
import './OptionPanel.css';

/* ── Copy ───────────────────────────────────────────────────────────────────
   One line per option explaining what the choice actually does. Keyed by id so
   the catalogue stays the single source of truth for names and prices.       */

const PAINT_NOTE: Record<string, string> = {
  'stellar-white': 'Solid finish under a hand-polished clear coat — no cost, no compromise.',
  'midnight-silver': 'Fine metallic flake that shifts from graphite to silver in low sun.',
  'deep-blue': 'Deep metallic blue that reads close to black in the shade.',
  obsidian: 'A dense black laid under a clear coat for depth across the shoulder line.',
  'ember-red': 'Multi-coat red over a bright metallic ground — the richest finish we make.',
  'quartz-grey': 'Warm metallic grey with a low-gloss flake that plays reflections down.',
};

const INTERIOR_NOTE: Record<string, string> = {
  'obsidian-int': 'Black perforated seating with dark ash trim and a black headliner.',
  'alpine-int': 'White seating against a black dash, with satin trim on the doors.',
  'cream-int': 'Cream seating with open-pore walnut across the dash and a woven headliner.',
};

const SEATING_NOTE: Record<number, string> = {
  5: 'Bench second row with a 60/40 fold and a flat load floor behind it.',
  6: 'Two captain’s chairs in the second row with a walk-through to the third.',
  7: 'A power-folding second row and a third row sized for two adults.',
};

const MOTOR_WORD: Record<number, string> = { 1: 'Single motor', 2: 'Dual motor', 3: 'Tri motor' };

/* Kept to a single line on purpose: the panel is one viewport tall, and every
   line spent here is a line the next section's heading loses. */
function trimNote(trim: Trim, wheel: WheelOption): string {
  const range = Math.max(0, trim.range + wheel.rangeDelta);
  return `${MOTOR_WORD[trim.motors] ?? 'Dual motor'} ${trim.drive} · ${num(trim.peakPower)} hp · ${num(range)} mi est. range`;
}

function wheelNote(wheel: WheelOption, trim: Trim): string {
  const range = Math.max(0, trim.range + wheel.rangeDelta);
  if (wheel.rangeDelta === 0) {
    return `Aerodynamic covers over a lightweight rim — the full ${num(range)} mi of estimated range.`;
  }
  return `${num(Math.abs(wheel.rangeDelta))} mi less range, ${num(range)} mi estimated, on a wider ${wheel.size}" performance tyre.`;
}

function paintNote(paint: PaintOption): string {
  return PAINT_NOTE[paint.id] ?? `${paint.metallic ? 'Metallic' : 'Solid'} finish under a hand-polished clear coat.`;
}

function interiorNote(interior: InteriorOption): string {
  return INTERIOR_NOTE[interior.id] ?? 'Vegan leather seating with matching door and dash trim.';
}

function seatingNote(seating: SeatingOption): string {
  return SEATING_NOTE[seating.seats] ?? `Seats ${seating.seats}.`;
}

/* ── Shared bits ────────────────────────────────────────────────────────────*/

interface SectionProps {
  id: string;
  title: string;
  name: string;
  delta?: string;
  note: string;
  children: ReactNode;
}

/** Heading, option group, then the live echo of what is selected. */
function Section({ id, title, name, delta, note, children }: SectionProps): ReactElement {
  return (
    <section className="op-sec" aria-labelledby={`${id}-h`}>
      <h2 className="op-sec__title" id={`${id}-h`}>
        {title}
      </h2>
      {children}
      <p className="op-echo">
        <span className="op-echo__name">{name}</span>
        {delta ? <span className="op-echo__delta">{delta}</span> : null}
      </p>
      <p className="op-echo__note">{note}</p>
    </section>
  );
}

/** The real rim design from the car render, drawn at thumbnail scale. */
function WheelArt({ wheel }: { wheel: WheelOption }): ReactElement {
  const uid = `wt${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg className="op-wheel__art" viewBox="-52 -52 104 104" aria-hidden="true">
      <defs>
        <RimDefs uid={uid} />
      </defs>
      <Wheel uid={uid} style={wheel.style} size={wheel.size} cx={0} cy={0} r={50} />
    </svg>
  );
}

interface AddOnCardProps {
  option: AddOnOption;
  selected: boolean;
  kind: 'radio' | 'checkbox';
  groupName?: string;
  onSelect: (id: string) => void;
}

function AddOnCard({ option, selected, kind, groupName, onSelect }: AddOnCardProps): ReactElement {
  const inputId = `ao${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const descId = `${inputId}-d`;
  return (
    <div className={`op-card${selected ? ' is-on' : ''}`} data-testid={`addon-${option.id}`}>
      <input
        id={inputId}
        className="op-card__input"
        type={kind}
        name={kind === 'radio' ? groupName : undefined}
        checked={selected}
        onChange={() => onSelect(option.id)}
        aria-describedby={descId}
      />
      <label className="op-card__label" htmlFor={inputId}>
        <span className="op-card__control" aria-hidden="true" />
        <span className="op-card__name">{option.name}</span>
        <span className="op-card__price">{signedMoney(option.price)}</span>
      </label>
      <div className="op-card__desc" id={descId}>
        <p className="op-card__summary">{option.summary}</p>
        <ul className="op-card__bullets">
          {option.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── Panel ──────────────────────────────────────────────────────────────────*/

export default function OptionPanel(): ReactElement {
  const { config, resolved, patchConfig, toggleAddOn } = useOrder();
  const { model, trim, paint, wheel, interior, seating } = resolved;
  const uid = `op${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  /* ≥1024px the stack is a viewport-tall scroller holding seven sections, so
     roughly a quarter of the build is on screen at once. Overlay scrollbars
     draw nothing until you already scrolled, which is exactly when the cue is
     no longer needed — so the rail is drawn here instead: length is the share
     of the stack on screen, position is how far down it you are. Decorative
     only; the scroller itself is what the keyboard and the platform drive. */
  const scrollRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);

  const syncRail = useCallback(() => {
    const el = scrollRef.current;
    const thumb = thumbRef.current;
    if (!el || !thumb) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const overflow = scrollHeight - clientHeight;
    if (overflow < 8) {
      thumb.style.opacity = '0';
      return;
    }
    const height = Math.max(32, Math.round((clientHeight / scrollHeight) * clientHeight));
    const travel = clientHeight - height;
    thumb.style.opacity = '1';
    thumb.style.height = `${height}px`;
    thumb.style.transform = `translateY(${Math.round((scrollTop / overflow) * travel)}px)`;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = (): void => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        syncRail();
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    const observer = new ResizeObserver(onScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [syncRail]);

  /* Content height moves with the model and with a note that rewraps, so the
     rail is re-measured after every commit, not just on scroll. */
  useEffect(syncRail);

  const baseTrimPrice = model.trims[0].price;
  const seatingOptions = model.seating.filter(
    (option) => !option.availableOn || option.availableOn.includes(model.id),
  );
  const autonomy = model.addOns.filter((option) => option.group === 'autonomy');
  const accessories = model.addOns.filter((option) => option.group !== 'autonomy');
  const activeAutonomy = autonomy.find((option) => config.addOnIds.includes(option.id));
  const activeAccessories = accessories.filter((option) => config.addOnIds.includes(option.id));
  const accessoryTotal = activeAccessories.reduce((sum, option) => sum + option.price, 0);

  return (
    <div className="op-panel" ref={scrollRef}>
      <div className="op-rail" aria-hidden="true">
        <span className="op-rail__thumb" ref={thumbRef} />
      </div>

      {/* ── Build header: the vehicle as currently specified ─────────────── */}
      <header className="op-head">
        <p className="op-head__eyebrow">Design your own</p>
        <h1 className="op-head__title">{model.name}</h1>
        <p className="op-head__lead">{model.leadTime}</p>
      </header>

      {/* ── Trim ────────────────────────────────────────────────────────── */}
      <Section
        id={`${uid}-trim`}
        title="Trim"
        name={trim.name}
        delta={trim.price > baseTrimPrice ? signedMoney(trim.price - baseTrimPrice) : money(trim.price)}
        note={trimNote(trim, wheel)}
      >
        <div className="op-group op-group--rows" role="radiogroup" aria-labelledby={`${uid}-trim-h`}>
          {model.trims.map((option) => (
            <label
              key={option.id}
              className={`op-trim${option.id === trim.id ? ' is-on' : ''}`}
              data-testid={`trim-${option.id}`}
            >
              <input
                className="op-input"
                type="radio"
                name={`${uid}-trim-g`}
                value={option.id}
                checked={option.id === trim.id}
                onChange={() => patchConfig({ trimId: option.id })}
              />
              <span className="op-trim__box">
                <span className="op-trim__head">
                  <span className="op-trim__name">{option.name}</span>
                  <span className="op-trim__price">{money(option.price)}</span>
                </span>
                <span className="op-trim__specs">
                  <span className="op-trim__spec">
                    <span className="op-trim__num">{num(option.range)}</span>
                    <span className="op-trim__unit">mi range</span>
                  </span>
                  <span className="op-trim__spec">
                    <span className="op-trim__num">{option.accel}</span>
                    <span className="op-trim__unit">s 0-60 mph</span>
                  </span>
                  <span className="op-trim__spec">
                    <span className="op-trim__num">{num(option.topSpeed)}</span>
                    <span className="op-trim__unit">mph top speed</span>
                  </span>
                </span>
              </span>
            </label>
          ))}
        </div>
      </Section>

      {/* ── Paint ───────────────────────────────────────────────────────── */}
      <Section
        id={`${uid}-paint`}
        title="Paint"
        name={paint.name}
        delta={signedMoney(paint.price)}
        note={paintNote(paint)}
      >
        <div className="op-group op-group--chips" role="radiogroup" aria-labelledby={`${uid}-paint-h`}>
          {model.paints.map((option) => (
            <label
              key={option.id}
              className={`op-chip${option.id === paint.id ? ' is-on' : ''}`}
              data-testid={`paint-${option.id}`}
              title={option.name}
            >
              <input
                className="op-input"
                type="radio"
                name={`${uid}-paint-g`}
                value={option.id}
                checked={option.id === paint.id}
                onChange={() => patchConfig({ paintId: option.id })}
              />
              <span className="op-chip__ring" aria-hidden="true">
                <span
                  className="op-chip__dot"
                  style={
                    {
                      '--sw-hex': option.hex,
                      '--sw-sheen': option.sheen,
                      '--sw-shade': option.shade,
                    } as CSSProperties
                  }
                />
              </span>
              <span className="sr-only">{`${option.name}, ${signedMoney(option.price)}`}</span>
            </label>
          ))}
        </div>
      </Section>

      {/* ── Wheels ──────────────────────────────────────────────────────── */}
      <Section
        id={`${uid}-wheels`}
        title="Wheels"
        name={wheel.name}
        delta={signedMoney(wheel.price)}
        note={wheelNote(wheel, trim)}
      >
        <div className="op-group op-group--tiles" role="radiogroup" aria-labelledby={`${uid}-wheels-h`}>
          {model.wheels.map((option) => (
            <label
              key={option.id}
              className={`op-tile op-wheel${option.id === wheel.id ? ' is-on' : ''}`}
              data-testid={`wheel-${option.id}`}
              title={option.name}
            >
              <input
                className="op-input"
                type="radio"
                name={`${uid}-wheels-g`}
                value={option.id}
                checked={option.id === wheel.id}
                onChange={() => patchConfig({ wheelId: option.id })}
              />
              <span className="op-tile__plate">
                <WheelArt wheel={option} />
              </span>
              <span className="op-tile__caption" aria-hidden="true">{`${option.size}″`}</span>
              <span className="sr-only">{`${option.name}, ${signedMoney(option.price)}`}</span>
            </label>
          ))}
        </div>
      </Section>

      {/* ── Interior ────────────────────────────────────────────────────── */}
      <Section
        id={`${uid}-interior`}
        title="Interior"
        name={interior.name}
        delta={signedMoney(interior.price)}
        note={interiorNote(interior)}
      >
        <div className="op-group op-group--tiles" role="radiogroup" aria-labelledby={`${uid}-interior-h`}>
          {model.interiors.map((option) => (
            <label
              key={option.id}
              className={`op-tile op-int${option.id === interior.id ? ' is-on' : ''}`}
              data-testid={`interior-${option.id}`}
              title={option.name}
            >
              <input
                className="op-input"
                type="radio"
                name={`${uid}-interior-g`}
                value={option.id}
                checked={option.id === interior.id}
                onChange={() => patchConfig({ interiorId: option.id })}
              />
              <span
                className="op-tile__plate op-int__plate"
                style={{ '--sw-a': option.swatch[0], '--sw-b': option.swatch[1] } as CSSProperties}
              />
              <span className="sr-only">{`${option.name}, ${signedMoney(option.price)}`}</span>
            </label>
          ))}
        </div>
      </Section>

      {/* ── Seating (only when the model offers a choice) ────────────────── */}
      {seatingOptions.length > 1 ? (
        <Section
          id={`${uid}-seating`}
          title="Seating"
          name={seating.name}
          delta={signedMoney(seating.price)}
          note={seatingNote(seating)}
        >
          <div className="op-group op-group--rows" role="radiogroup" aria-labelledby={`${uid}-seating-h`}>
            {seatingOptions.map((option) => (
              <label
                key={option.id}
                className={`op-row${option.id === seating.id ? ' is-on' : ''}`}
                data-testid={`seating-${option.id}`}
              >
                <input
                  className="op-input"
                  type="radio"
                  name={`${uid}-seating-g`}
                  value={option.id}
                  checked={option.id === seating.id}
                  onChange={() => patchConfig({ seatingId: option.id })}
                />
                <span className="op-row__box">
                  <span className="op-row__name">{option.name}</span>
                  <span className="op-row__price">{signedMoney(option.price)}</span>
                </span>
              </label>
            ))}
          </div>
        </Section>
      ) : null}

      {/* ── Autonomy ────────────────────────────────────────────────────── */}
      <Section
        id={`${uid}-autonomy`}
        title="Autonomy"
        name={activeAutonomy ? activeAutonomy.name : 'Autopilot'}
        delta={signedMoney(activeAutonomy ? activeAutonomy.price : 0)}
        note={activeAutonomy ? activeAutonomy.summary : 'Included as standard on every Vela.'}
      >
        <div className="op-group op-group--cards" role="radiogroup" aria-labelledby={`${uid}-autonomy-h`}>
          {autonomy.map((option) => (
            <AddOnCard
              key={option.id}
              option={option}
              kind="radio"
              groupName={`${uid}-autonomy-g`}
              selected={activeAutonomy?.id === option.id}
              onSelect={toggleAddOn}
            />
          ))}
        </div>
      </Section>

      {/* ── Accessories ─────────────────────────────────────────────────── */}
      <Section
        id={`${uid}-accessories`}
        title="Accessories"
        name={
          activeAccessories.length
            ? activeAccessories.map((option) => option.name).join(' + ')
            : 'No accessories added'
        }
        delta={activeAccessories.length ? signedMoney(accessoryTotal) : undefined}
        note={
          activeAccessories.length
            ? activeAccessories.map((option) => option.summary).join(' ')
            : 'You can add accessories to this order any time before it goes into production.'
        }
      >
        <div className="op-group op-group--cards" role="group" aria-labelledby={`${uid}-accessories-h`}>
          {accessories.map((option) => (
            <AddOnCard
              key={option.id}
              option={option}
              kind="checkbox"
              selected={config.addOnIds.includes(option.id)}
              onSelect={toggleAddOn}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
