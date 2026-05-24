import { createContext, use } from 'react';

export type LengthUnit = 'px' | 'yalm';

export const DEFAULT_PIXELS_PER_YALM = 15;

export type LengthUnitState = [LengthUnit, (u: LengthUnit) => void];

export const LengthUnitContext = createContext<LengthUnitState>(['px', () => undefined]);

export function useLengthUnit(): LengthUnitState {
    return use(LengthUnitContext);
}
