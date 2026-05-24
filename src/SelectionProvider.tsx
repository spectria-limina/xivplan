import React, { type PropsWithChildren, useState } from 'react';
import {
    DragSelectionContext,
    DragSelectPreviewContext,
    type SceneSelection,
    SelectionContext,
    SpotlightContext,
} from './SelectionContext';

export const SelectionProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const state = useState<SceneSelection>(() => new Set());
    const dragState = useState<SceneSelection>(() => new Set());
    const spotlightState = useState<SceneSelection>(() => new Set());
    const dragSelectPreviewState = useState<ReadonlySet<number> | null>(null);

    return (
        <SelectionContext value={state}>
            <SpotlightContext value={spotlightState}>
                <DragSelectPreviewContext value={dragSelectPreviewState}>
                    <DragSelectionContext value={dragState}>{children}</DragSelectionContext>
                </DragSelectPreviewContext>
            </SpotlightContext>
        </SelectionContext>
    );
};
