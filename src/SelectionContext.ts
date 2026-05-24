import { createContext, type Dispatch, type SetStateAction } from 'react';

/**
 * Set of object IDs for selected objects.
 */
export type SceneSelection = ReadonlySet<number>;

export type SelectionState = [SceneSelection, Dispatch<SetStateAction<SceneSelection>>];

/**
 * Set of objects that are selected.
 */
export const SelectionContext = createContext<SelectionState>([new Set(), () => undefined]);

/**
 * Set of objects that are highlighted (e.g. when the user hovers over an object
 * in the scene list, to show that object in the scene).
 */
export const SpotlightContext = createContext<SelectionState>([new Set(), () => undefined]);

/**
 * Set of objects that are currently being dragged.
 *
 * When not dragging, the set should be empty. When starting a drag, the drag
 * selection should be set to match the moveable objects in the regular selection
 * using getNewDragSelection(). This ensures that changing the selection in the
 * middle of a drag doesn't break anything.
 */
export const DragSelectionContext = createContext<SelectionState>([new Set(), () => undefined]);

/**
 * The previewed selection during a drag-select.
 *
 * When `null`, no drag select is in progress and the actual selection is shown
 * normally. When a Set, the drag select is active and the preview should fully
 * override the displayed selection — objects in the set highlight as selected,
 * objects outside it appear unselected even if they are in the real selection.
 * The real selection is not updated until the drag releases.
 */
export type DragSelectPreviewState = [ReadonlySet<number> | null, Dispatch<SetStateAction<ReadonlySet<number> | null>>];

export const DragSelectPreviewContext = createContext<DragSelectPreviewState>([null, () => undefined]);
