import { useId, type ReactElement } from 'react';
import CarRender from '@/components/car/CarRender';
import type { CarModel, PaintOption, Trim, WheelOption } from '@/types';
import './RenderStage.css';

export type StageView = 'front-3q' | 'side';

export interface RenderStageProps {
  model: CarModel;
  trim: Trim;
  paint: PaintOption;
  wheel: WheelOption;
  view: StageView;
  onViewChange: (view: StageView) => void;
}

const VIEWS: { id: StageView; label: string }[] = [
  { id: 'front-3q', label: 'Front three-quarter view' },
  { id: 'side', label: 'Side profile view' },
];

/**
 * The studio plate. Both angles stay mounted and cross-fade, so switching the
 * view never re-lays-out the SVG and a paint change still animates on the layer
 * you are not looking at. Nothing in the plate sits over the car: the caption
 * is above it, the angle row below it.
 */
export default function RenderStage({
  model,
  trim,
  paint,
  wheel,
  view,
  onViewChange,
}: RenderStageProps): ReactElement {
  const groupName = `stage-view-${useId()}`;

  return (
    <div className="stage">
      <div className="stage__meta">
        <p className="stage__model">{model.name}</p>
        <p className="stage__trim">{trim.name}</p>
      </div>

      <div className="stage__car">
        <div className="stage__frame">
          {VIEWS.map((v) => (
            <div
              key={v.id}
              className={`stage__layer${v.id === view ? ' is-active' : ''}`}
              aria-hidden={v.id === view ? undefined : true}
            >
              <CarRender
                className="stage__svg"
                body={model.body}
                paint={paint}
                wheel={wheel}
                view={v.id}
                label={`${model.name} ${trim.name} in ${paint.name} with ${wheel.name}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="stage__angles" role="radiogroup" aria-label="Vehicle angle">
        {VIEWS.map((v) => (
          <label
            key={v.id}
            className={`stage__angle${v.id === view ? ' is-active' : ''}`}
            data-testid={`angle-${v.id}`}
          >
            <input
              className="stage__angleInput"
              type="radio"
              name={groupName}
              value={v.id}
              checked={v.id === view}
              onChange={() => onViewChange(v.id)}
            />
            <span className="stage__angleArt" aria-hidden="true">
              <CarRender body={model.body} paint={paint} wheel={wheel} view={v.id} ground={false} />
            </span>
            <span className="sr-only">{v.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
