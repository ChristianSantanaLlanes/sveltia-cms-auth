import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { defaultConfig } from '@/data/models';
import { priceConfig, resolveConfig } from '@/lib/pricing';
import { readJSON, writeJSON } from '@/lib/storage';
import type { PaymentMode, VehicleConfig } from '@/types';

const STORAGE_KEY = 'vela.order.v1';

interface OrderState {
  config: VehicleConfig;
  paymentMode: PaymentMode;
  zip: string;
  inventoryId: string | null;
}

interface OrderContextValue extends OrderState {
  setConfig: (next: VehicleConfig | ((prev: VehicleConfig) => VehicleConfig)) => void;
  patchConfig: (patch: Partial<VehicleConfig>) => void;
  toggleAddOn: (id: string) => void;
  startModel: (modelId: string) => void;
  setPaymentMode: (mode: PaymentMode) => void;
  setZip: (zip: string) => void;
  setInventoryId: (id: string | null) => void;
  price: ReturnType<typeof priceConfig>;
  resolved: ReturnType<typeof resolveConfig>;
  reset: () => void;
}

const initialState = (): OrderState => ({
  config: defaultConfig('vela-3'),
  paymentMode: 'finance',
  zip: '94538',
  inventoryId: null,
});

const OrderContext = createContext<OrderContextValue | null>(null);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OrderState>(() => readJSON(STORAGE_KEY, initialState()));

  useEffect(() => {
    writeJSON(STORAGE_KEY, state);
  }, [state]);

  const setConfig: OrderContextValue['setConfig'] = useCallback((next) => {
    setState((prev) => ({ ...prev, config: typeof next === 'function' ? next(prev.config) : next }));
  }, []);

  const patchConfig = useCallback((patch: Partial<VehicleConfig>) => {
    setState((prev) => ({ ...prev, config: { ...prev.config, ...patch } }));
  }, []);

  const toggleAddOn = useCallback((id: string) => {
    setState((prev) => {
      const model = resolveConfig(prev.config).model;
      const option = model.addOns.find((a) => a.id === id);
      if (!option) return prev;
      let ids = prev.config.addOnIds;
      if (option.group) {
        ids = ids.filter((existing) => {
          const other = model.addOns.find((a) => a.id === existing);
          return other?.group !== option.group;
        });
        ids = [...ids, id];
      } else {
        ids = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
      }
      return { ...prev, config: { ...prev.config, addOnIds: ids } };
    });
  }, []);

  const startModel = useCallback((modelId: string) => {
    setState((prev) => ({ ...prev, inventoryId: null, config: defaultConfig(modelId) }));
  }, []);

  const value = useMemo<OrderContextValue>(() => {
    const price = priceConfig(state.config);
    const resolved = resolveConfig(state.config);
    return {
      ...state,
      setConfig,
      patchConfig,
      toggleAddOn,
      startModel,
      setPaymentMode: (mode) => setState((prev) => ({ ...prev, paymentMode: mode })),
      setZip: (zip) => setState((prev) => ({ ...prev, zip })),
      setInventoryId: (id) => setState((prev) => ({ ...prev, inventoryId: id })),
      price,
      resolved,
      reset: () => setState(initialState()),
    };
  }, [state, setConfig, patchConfig, toggleAddOn, startModel]);

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrder() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrder must be used inside <OrderProvider>');
  return ctx;
}
