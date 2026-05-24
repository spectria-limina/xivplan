import React, { type PropsWithChildren } from 'react';
import { useLocalStorage } from 'react-use';
import { type LengthUnit, LengthUnitContext, type LengthUnitState } from './LengthUnitContext';

export const LengthUnitProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const [unit, setUnit] = useLocalStorage<LengthUnit>('lengthUnit', 'px');
    const state: LengthUnitState = [unit ?? 'px', setUnit as (u: LengthUnit) => void];

    return <LengthUnitContext value={state}>{children}</LengthUnitContext>;
};
