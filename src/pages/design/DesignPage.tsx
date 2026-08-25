import { useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { useParams } from 'react-router-dom';
import { getModel } from '@/data/models';
import useMediaQuery from '@/hooks/useMediaQuery';
import NotFoundPage from '@/pages/NotFoundPage';
import { useOrder } from '@/store/OrderContext';
import type { CarModel } from '@/types';
import OptionPanel from './OptionPanel';
import PriceSummary from './PriceSummary';
import RenderStage, { type StageView } from './RenderStage';
import './DesignPage.css';

/**
 * `/design/:modelId`
 *
 * The route only resolves the model and hands off; every hook lives in
 * <Configurator> so an unknown `:modelId` can fall through to the 404 page
 * without changing hook order between renders. Keying the configurator on the
 * model id also resets the stage angle when the shopper switches vehicles.
 */
export default function DesignPage(): ReactElement {
  const { modelId } = useParams<{ modelId: string }>();
  const model = modelId ? getModel(modelId) : undefined;

  if (!model) return <NotFoundPage />;

  return <Configurator key={model.id} model={model} />;
}

function Configurator({ model }: { model: CarModel }): ReactElement {
  const { config, resolved, startModel } = useOrder();
  const [view, setView] = useState<StageView>('front-3q');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  /* The order in context survives navigation and reloads, so it may still hold
     the previous vehicle. Reset it before the browser paints — never in a way
     that can re-fire: `startedRef` latches the id we already handed to
     startModel, and the component is keyed by model id so the latch is fresh
     for every vehicle. */
  const startedRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (config.modelId === model.id) {
      startedRef.current = model.id;
      return;
    }
    if (startedRef.current === model.id) return;
    startedRef.current = model.id;
    startModel(model.id);
  }, [config.modelId, model.id, startModel]);

  return (
    <div className="design">
      <div className="design__render">
        <RenderStage
          model={resolved.model}
          trim={resolved.trim}
          paint={resolved.paint}
          wheel={resolved.wheel}
          view={view}
          onViewChange={setView}
        />
      </div>

      <div className="design__panel">
        <OptionPanel />
        <PriceSummary variant={isDesktop ? 'pinned' : 'bar'} />
      </div>
    </div>
  );
}
