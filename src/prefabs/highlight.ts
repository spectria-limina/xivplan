import type { ShapeConfig } from 'konva/lib/Shape';
import { getPositionParentId, useIsAllowedConnectionTarget } from '../connections';
import { EditMode } from '../editMode';
import { isMoveable, type UnknownObject } from '../scene';
import { getObjectById, useScene } from '../SceneProvider';
import { useDragSelectPreview, useSelection, useSpotlight } from '../selection';
import type { SceneSelection } from '../SelectionContext';
import { SELECTED_CONNECTED_PROPS, SELECTED_PROPS, SPOTLIGHT_CONNECTED_PROPS, SPOTLIGHT_PROPS } from '../theme';
import { useEditMode } from '../useEditMode';

function shouldShowResizer(object: UnknownObject, selection: SceneSelection, editMode: EditMode) {
    return (
        selection.size === 1 &&
        selection.has(object.id) &&
        editMode === EditMode.Normal &&
        isMoveable(object) &&
        !object.pinned
    );
}

export function useHighlightProps(object: UnknownObject): ShapeConfig | undefined {
    const [editMode] = useEditMode();
    const [selection] = useSelection();
    const [spotlight] = useSpotlight();
    const [dragSelectPreview] = useDragSelectPreview();
    const scene = useScene().scene;

    // While a drag select is active the preview fully overrides the displayed selection.
    const effectiveSelection = dragSelectPreview ?? selection;
    const isDragSelectActive = dragSelectPreview !== null;

    // Spotlight only applies in normal mode; during drag select we don't want hover
    // styling to compete with the preview.
    if (!isDragSelectActive && spotlight.has(object.id) && !(selection.size === 1 && selection.has(object.id))) {
        return SPOTLIGHT_PROPS;
    }

    if (effectiveSelection.has(object.id)) {
        // In normal mode with exactly one selected object the resizer takes the
        // place of the highlight. During a drag select the resizer is suppressed,
        // so we always need to draw the highlight to show single-object hits.
        if (isDragSelectActive || !shouldShowResizer(object, effectiveSelection, editMode)) {
            return SELECTED_PROPS;
        }
    }

    // If one of the objects this is connected to is in the spotlight or selection
    let positionParentId = getPositionParentId(object);
    while (positionParentId !== undefined) {
        if (!isDragSelectActive && spotlight.has(positionParentId)) {
            // This is slightly weird when the parent object has a resizer thing.
            // maybe the resizer should follow the spotlight coloring?
            return SPOTLIGHT_CONNECTED_PROPS;
        }
        if (effectiveSelection.has(positionParentId)) {
            return SELECTED_CONNECTED_PROPS;
        }
        const parentObject = getObjectById(scene, positionParentId);
        positionParentId = getPositionParentId(parentObject);
    }

    return undefined;
}

export function useOverrideProps(object: UnknownObject): ShapeConfig | undefined {
    const [editMode] = useEditMode();
    const [selection] = useSelection();
    const isAllowedConnectionTarget = useIsAllowedConnectionTarget(object.id);
    if (editMode == EditMode.SelectConnection && !isAllowedConnectionTarget && !selection.has(object.id)) {
        return { opacity: 0.1 };
    }
    return undefined;
}

export function useShowResizer(object: UnknownObject): boolean {
    const [editMode] = useEditMode();
    const [selection] = useSelection();
    const [dragSelectPreview] = useDragSelectPreview();
    // Suppress the resizer while a drag select is in progress so we don't suggest a
    // commitment to the in-progress selection.
    if (dragSelectPreview !== null) return false;
    return shouldShowResizer(object, selection, editMode);
}
