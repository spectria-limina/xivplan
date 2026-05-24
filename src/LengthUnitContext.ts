import { createContext, use } from 'react';

export type LengthUnit = 'px' | 'yalm';

// Pixels/yalm
export const DEFAULT_LENGTH_SCALE = 15;

export type LengthUnitState = [LengthUnit, (u: LengthUnit) => void];

export const LengthUnitContext = createContext<LengthUnitState>(['px', () => undefined]);

export function useLengthUnit(): LengthUnitState {
    return use(LengthUnitContext);
}
