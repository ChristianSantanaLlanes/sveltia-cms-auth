import CarRenderA from '@/components/car/CarRenderA';
import CarRenderB from '@/components/car/CarRenderB';
import CarRenderC from '@/components/car/CarRenderC';
import { MODEL_BY_ID } from '@/data/models';
import './CarLab.css';

const sedan = MODEL_BY_ID['vela-3'];
const suv = MODEL_BY_ID['vela-y'];

const VARIANTS = [
  { key: 'A', Component: CarRenderA },
  { key: 'B', Component: CarRenderB },
  { key: 'C', Component: CarRenderC },
] as const;

/**
 * Bake-off stage. Each variant renders the same four cases so a judge can compare
 * them without knowing which team built which column.
 */
export default function CarLab() {
  const cases = [
    { id: 'sedan-blue', label: 'Sedan · Deep Blue · 19" sport', body: 'sedan' as const, paint: sedan.paints[2], wheel: sedan.wheels[1] },
    { id: 'sedan-white', label: 'Sedan · Stellar White · 18" aero', body: 'sedan' as const, paint: sedan.paints[0], wheel: sedan.wheels[0] },
    { id: 'sedan-red', label: 'Sedan · Ember Red · 20" arc', body: 'sedan' as const, paint: sedan.paints[4], wheel: sedan.wheels[2] },
    { id: 'suv-black', label: 'SUV · Obsidian · 20" turbine', body: 'suv' as const, paint: suv.paints[3], wheel: suv.wheels[1] },
  ];

  return (
    <div className="lab">
      {cases.map((c) => (
        <section key={c.id} className="lab__row">
          <h2 className="lab__label">{c.label}</h2>
          <div className="lab__cols">
            {VARIANTS.map(({ key, Component }) => (
              <figure key={key} className="lab__cell" data-variant={key}>
                <Component body={c.body} paint={c.paint} wheel={c.wheel} view="front-3q" />
                <figcaption>{key}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
      <section className="lab__row">
        <h2 className="lab__label">Side view · Midnight Silver</h2>
        <div className="lab__cols">
          {VARIANTS.map(({ key, Component }) => (
            <figure key={key} className="lab__cell" data-variant={key}>
              <Component body="sedan" paint={sedan.paints[1]} wheel={sedan.wheels[1]} view="side" />
              <figcaption>{key}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
