import Konva from 'konva';
import type { Node, KonvaEventObject } from 'konva/lib/Node';
import type { Stage } from 'konva/lib/Stage';
import type { Vector2d } from 'konva/lib/types';
import React, { useEffect, useRef, useState } from 'react';
import { Layer, Rect } from 'react-konva';
import {
    getAbsoluteRotation,
    getCanvasCoord,
    rectIntersectsAnnularSector,
    rectIntersectsAnnulus,
    rectIntersectsCircle,
    rectIntersectsConvexPolygon,
    rectIntersectsOffsetRotatedRect,
    rectIntersectsRotatedRect,
    rectIntersectsSegment,
    rectIntersectsWedge,
    type Rect as DragRect,
} from '../coord';
import { EditMode } from '../editMode';
import { OBJECT_GROUP_NAME } from '../objectIds';
import { getObjectById, useCurrentStep, useScene } from '../SceneProvider';
import {
    isArcZone,
    isConeZone,
    isDonutZone,
    isDrawObject,
    isExaflareZone,
    isLineZone,
    isMoveable,
    isPolygonZone,
    isRadiusObject,
    isResizable,
    isRotateable,
    isStarburstZone,
    isText,
    isTether,
    ObjectType,
    type Scene,
    type SceneObject,
} from '../scene';
import { useDragSelectPreview, useSelection } from '../selection';
import type { SceneSelection } from '../SelectionContext';
import { useEditMode } from '../useEditMode';
import { degtorad } from '../util';
import { setDragSelectJustCommitted } from './dragSelect';
import { useStage } from './stage';

const DRAG_THRESHOLD = 4;
const TEXT_LINE_HEIGHT = 1.2;

type SelectMode = 'replace' | 'add' | 'subtract';

interface DragState {
    startX: number;
    startY: number;
    baseSelection: SceneSelection;
    moved: boolean;
    lastX: number;
    lastY: number;
}

interface ModifierState {
    shiftKey: boolean;
    ctrlKey: boolean;
}

type HitFn = (rect: DragRect) => boolean;

function makeRect(x1: number, y1: number, x2: number, y2: number): DragRect {
    return {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
    };
}

function getModeFromEvent(e: ModifierState): SelectMode {
    if (e.shiftKey) return 'add';
    if (e.ctrlKey) return 'subtract';
    return 'replace';
}

function shouldStartDragSelect(target: Node, stage: Stage): boolean {
    let n: Node | null = target;
    while (n && n !== stage) {
        if (n.draggable()) return false;
        if (n.name() === OBJECT_GROUP_NAME) return false;
        // Konva Transformer anchors have the '_anchor' name component.
        if (n.hasName('_anchor')) return false;
        n = n.getParent();
    }
    return true;
}

function applyMode(base: SceneSelection, hits: ReadonlySet<number>, mode: SelectMode): ReadonlySet<number> {
    switch (mode) {
        case 'replace':
            return hits;
        case 'add': {
            const next = new Set(base);
            hits.forEach((id) => next.add(id));
            return next;
        }
        case 'subtract': {
            const next = new Set(base);
            hits.forEach((id) => next.delete(id));
            return next;
        }
    }
}

function rotatePoint(p: Vector2d, cos: number, sin: number): Vector2d {
    return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

function rotateAndTranslate(pts: Vector2d[], cos: number, sin: number, cx: number, cy: number): Vector2d[] {
    return pts.map((p) => ({ x: cx + p.x * cos - p.y * sin, y: cy + p.x * sin + p.y * cos }));
}

function regularPolygonVertices(center: Vector2d, radius: number, sides: number, rotDeg: number): Vector2d[] {
    // Matches Konva RegularPolygon: first vertex straight up (sin/cos formula),
    // then clockwise. Additional group rotation is applied on top.
    const rad = degtorad(rotDeg);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const pts: Vector2d[] = [];
    for (let n = 0; n < sides; n++) {
        const t = (n * 2 * Math.PI) / sides;
        pts.push({ x: radius * Math.sin(t), y: -radius * Math.cos(t) });
    }
    return rotateAndTranslate(pts, cos, sin, center.x, center.y);
}

function measureTextSize(text: string, fontSize: number): { width: number; height: number } {
    const tmp = new Konva.Text({ fontSize });
    const lines = text.split('\n');
    const width = lines.reduce((w, line) => Math.max(w, tmp.measureSize(line).width), 0);
    const height = fontSize * TEXT_LINE_HEIGHT * lines.length;
    tmp.destroy();
    return { width, height };
}

/**
 * Build a closure that tests whether a drag rect overlaps this specific
 * object. Geometry is captured once so per-frame calls stay cheap.
 * Returns null for objects with no intrinsic spatial footprint (e.g. a tether
 * with missing endpoints).
 */
function makeHitFn(scene: Scene, obj: SceneObject): HitFn | null {
    // ── Tether ────────────────────────────────────────────────────────────────
    if (isTether(obj)) {
        const startObj = getObjectById(scene, obj.startId);
        const endObj = getObjectById(scene, obj.endId);
        if (!isMoveable(startObj) || !isMoveable(endObj)) return null;
        const a = getCanvasCoord(scene, startObj);
        const b = getCanvasCoord(scene, endObj);
        return (r) => rectIntersectsSegment(r, a, b);
    }

    if (!isMoveable(obj)) return null;

    const center = getCanvasCoord(scene, obj);
    const rotation = isRotateable(obj) ? getAbsoluteRotation(scene, obj) : 0;
    const rad = degtorad(rotation);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // ── Cone / Arc ────────────────────────────────────────────────────────────
    // ZoneCone/ZoneArc: group rotated by `rotation - 90 - coneAngle/2`
    if (isConeZone(obj)) {
        const start = rotation - 90 - obj.coneAngle / 2;
        const end = rotation - 90 + obj.coneAngle / 2;
        const r = obj.radius;
        return (m) => rectIntersectsWedge(m, center, r, start, end);
    }
    if (isArcZone(obj)) {
        const start = rotation - 90 - obj.coneAngle / 2;
        const end = rotation - 90 + obj.coneAngle / 2;
        const outer = obj.radius;
        const inner = obj.innerRadius;
        return (m) => rectIntersectsAnnularSector(m, center, outer, inner, start, end);
    }

    // ── Donut ─────────────────────────────────────────────────────────────────
    if (isDonutZone(obj)) {
        const outer = obj.radius;
        const inner = obj.innerRadius;
        return (m) => rectIntersectsAnnulus(m, center, outer, inner);
    }

    // ── Starburst ─────────────────────────────────────────────────────────────
    // Union of spoke rectangles; even/odd spoke layout matches ZoneStarburst.tsx.
    if (isStarburstZone(obj)) {
        const { radius, spokes, spokeWidth } = obj;
        if (spokes % 2 === 0) {
            // Even: items = spokes/2 full-span rects, angles (i/items)*180.
            const items = spokes / 2;
            const hitFns = Array.from({ length: items }, (_, i) => {
                const totalRot = rotation + (i / items) * 180;
                return (m: DragRect) =>
                    rectIntersectsOffsetRotatedRect(
                        m,
                        center,
                        -spokeWidth / 2,
                        -radius,
                        spokeWidth,
                        radius * 2,
                        totalRot,
                    );
            });
            return (m) => hitFns.some((fn) => fn(m));
        } else {
            // Odd: spokes half-rects from origin outward, starting at rotation+180.
            const hitFns = Array.from({ length: spokes }, (_, i) => {
                const totalRot = rotation + 180 + (i / spokes) * 360;
                return (m: DragRect) =>
                    rectIntersectsOffsetRotatedRect(m, center, -spokeWidth / 2, 0, spokeWidth, radius, totalRot);
            });
            return (m) => hitFns.some((fn) => fn(m));
        }
    }

    // ── Regular polygon ───────────────────────────────────────────────────────
    if (isPolygonZone(obj)) {
        const orientRotation = obj.orient === 'side' ? 180 / obj.sides : 0;
        const verts = regularPolygonVertices(center, obj.radius, obj.sides, rotation + orientRotation);
        return (m) => rectIntersectsConvexPolygon(m, verts);
    }

    // ── Triangle / RightTriangle ──────────────────────────────────────────────
    // Both are RectangleZone subtypes; distinguish by object.type.
    if ((obj.type === ObjectType.Triangle || obj.type === ObjectType.RightTriangle) && isResizable(obj)) {
        const w = obj.width;
        const h = obj.height;
        // Triangle (equilateral-ish): top-center, bottom-left, bottom-right.
        // Group offsetY = (2h)/3, so vertices relative to center:
        //   (0, -2h/3), (-w/2, h/3), (w/2, h/3)
        // RightTriangle: right angle at top-left of bounding rect.
        // groupProps offsetX=w/2, offsetY=h/2 (no override):
        //   (-w/2, -h/2), (-w/2, h/2), (w/2, h/2)
        const localVerts: Vector2d[] =
            obj.type === ObjectType.Triangle
                ? [
                      { x: 0, y: (-2 * h) / 3 },
                      { x: -w / 2, y: h / 3 },
                      { x: w / 2, y: h / 3 },
                  ]
                : [
                      { x: -w / 2, y: -h / 2 },
                      { x: -w / 2, y: h / 2 },
                      { x: w / 2, y: h / 2 },
                  ];
        const verts = rotateAndTranslate(localVerts, cos, sin, center.x, center.y);
        return (m) => rectIntersectsConvexPolygon(m, verts);
    }

    // ── Freehand draw ─────────────────────────────────────────────────────────
    // Polyline stored as relative coords; group offsetX/Y overridden to 0.
    if (isDrawObject(obj)) {
        const { width, height, points: relPts } = obj;
        // Convert relative pairs to canvas coords (rotation applied).
        const canvasPts: Vector2d[] = [];
        for (let i = 0; i < relPts.length - 1; i += 2) {
            const lx = (relPts[i] ?? 0) * width;
            const ly = (relPts[i + 1] ?? 0) * -height;
            canvasPts.push(rotatePoint({ x: lx, y: ly }, cos, sin));
        }
        // Translate to canvas space.
        const canvasAbs = canvasPts.map((p) => ({ x: center.x + p.x, y: center.y + p.y }));
        return (m) => {
            for (let i = 0; i < canvasAbs.length - 1; i++) {
                if (rectIntersectsSegment(m, canvasAbs[i]!, canvasAbs[i + 1]!)) return true;
            }
            return false;
        };
    }

    // ── Text ──────────────────────────────────────────────────────────────────
    // Group has offsetX = width/2, offsetY = height/2, so the text rect is
    // centered on `center`. We measure size using a temporary Konva.Text node.
    if (isText(obj)) {
        const { width, height } = measureTextSize(obj.text, obj.fontSize);
        const halfW = width / 2;
        const halfH = height / 2;
        return (m) => rectIntersectsRotatedRect(m, center, halfW, halfH, rotation);
    }

    // ── Line zone ─────────────────────────────────────────────────────────────
    if (isLineZone(obj)) {
        return (m) =>
            rectIntersectsOffsetRotatedRect(m, center, -obj.width / 2, -obj.length, obj.width, obj.length, rotation);
    }

    // ── Exaflare ──────────────────────────────────────────────────────────────
    // Trail of circles extending upward; bound as a rotated rect.
    if (isExaflareZone(obj)) {
        const r = obj.radius;
        const step = (2 * r * obj.spacing) / 100;
        const trailH = (obj.length - 1) * step + 2 * r;
        return (m) =>
            rectIntersectsOffsetRotatedRect(m, center, -r, -((obj.length - 1) * step) - r, 2 * r, trailH, rotation);
    }

    // ── Resizable (Rect zones, markers, icons, actors, arrows, draw…) ─────────
    if (isResizable(obj)) {
        const halfW = obj.width / 2;
        const halfH = obj.height / 2;
        return (m) => rectIntersectsRotatedRect(m, center, halfW, halfH, rotation);
    }

    // ── Radius (Circle, Donut outer, Knockback, Stack, Tower, Enemy, Eye…) ────
    if (isRadiusObject(obj)) {
        const r = obj.radius;
        return (m) => rectIntersectsCircle(m, { x: center.x, y: center.y, radius: r });
    }

    return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DragSelector: React.FC = () => {
    const stage = useStage();
    const [editMode] = useEditMode();
    const [selection, setSelection] = useSelection();
    const [, setPreview] = useDragSelectPreview();
    const step = useCurrentStep();
    const { scene } = useScene();

    const stepRef = useRef(step);
    const sceneRef = useRef(scene);
    const selectionRef = useRef(selection);
    const setSelectionRef = useRef(setSelection);
    const setPreviewRef = useRef(setPreview);
    useEffect(() => {
        stepRef.current = step;
        sceneRef.current = scene;
        selectionRef.current = selection;
        setSelectionRef.current = setSelection;
        setPreviewRef.current = setPreview;
    });

    const dragRef = useRef<DragState | null>(null);
    const [rect, setRect] = useState<DragRect | null>(null);

    useEffect(() => {
        if (!stage || editMode !== EditMode.Normal) return;

        // Snapshot hit functions at drag start. Objects don't move during the
        // drag select, so we lock in their geometry once and call closures per frame.
        let hitList: { id: number; hit: HitFn }[] = [];

        const snapshot = () => {
            const list: { id: number; hit: HitFn }[] = [];
            for (const obj of stepRef.current.objects) {
                if (obj.hide) continue;
                const hit = makeHitFn(sceneRef.current, obj);
                if (hit) list.push({ id: obj.id, hit });
            }
            return list;
        };

        const computeHits = (dragRect: DragRect): Set<number> => {
            const ids = new Set<number>();
            for (const { id, hit } of hitList) {
                if (hit(dragRect)) ids.add(id);
            }
            return ids;
        };

        const refreshPreview = (mode: SelectMode) => {
            const state = dragRef.current;
            if (!state || !state.moved) return;
            const dragRect = makeRect(state.startX, state.startY, state.lastX, state.lastY);
            setPreviewRef.current(applyMode(state.baseSelection, computeHits(dragRect), mode));
        };

        const endDrag = (commit: boolean, modifiers: ModifierState | null) => {
            const state = dragRef.current;
            if (!state) return;

            if (commit && state.moved && modifiers) {
                const dragRect = makeRect(state.startX, state.startY, state.lastX, state.lastY);
                setSelectionRef.current(
                    applyMode(state.baseSelection, computeHits(dragRect), getModeFromEvent(modifiers)),
                );
                setDragSelectJustCommitted();
            }

            dragRef.current = null;
            hitList = [];
            setRect(null);
            setPreviewRef.current(null);
        };

        const onMouseDown = (e: KonvaEventObject<MouseEvent>) => {
            if (e.evt.button !== 0) return;
            if (!shouldStartDragSelect(e.target, stage)) return;
            const pos = stage.getPointerPosition();
            if (!pos) return;
            hitList = snapshot();
            dragRef.current = {
                startX: pos.x,
                startY: pos.y,
                baseSelection: selectionRef.current,
                moved: false,
                lastX: pos.x,
                lastY: pos.y,
            };
        };

        const onMouseMove = (e: KonvaEventObject<MouseEvent>) => {
            const state = dragRef.current;
            if (!state) return;
            const pos = stage.getPointerPosition();
            if (!pos) return;
            state.lastX = pos.x;
            state.lastY = pos.y;
            if (!state.moved && Math.hypot(pos.x - state.startX, pos.y - state.startY) < DRAG_THRESHOLD) return;
            state.moved = true;
            setRect(makeRect(state.startX, state.startY, pos.x, pos.y));
            refreshPreview(getModeFromEvent(e.evt));
        };

        const onMouseUp = (e: KonvaEventObject<MouseEvent>) => endDrag(true, e.evt);
        const onWindowMouseUp = (e: MouseEvent) => endDrag(true, e);
        const onWindowBlur = () => endDrag(false, null);
        const onModifierChange = (e: KeyboardEvent) => {
            if (!dragRef.current || (e.key !== 'Shift' && e.key !== 'Control')) return;
            refreshPreview(getModeFromEvent(e));
        };

        stage.on('mousedown.dragselect', onMouseDown);
        stage.on('mousemove.dragselect', onMouseMove);
        stage.on('mouseup.dragselect', onMouseUp);
        window.addEventListener('mouseup', onWindowMouseUp);
        window.addEventListener('blur', onWindowBlur);
        window.addEventListener('keydown', onModifierChange);
        window.addEventListener('keyup', onModifierChange);

        return () => {
            stage.off('mousedown.dragselect');
            stage.off('mousemove.dragselect');
            stage.off('mouseup.dragselect');
            window.removeEventListener('mouseup', onWindowMouseUp);
            window.removeEventListener('blur', onWindowBlur);
            window.removeEventListener('keydown', onModifierChange);
            window.removeEventListener('keyup', onModifierChange);
            dragRef.current = null;
            hitList = [];
            setRect(null);
            setPreviewRef.current(null);
        };
    }, [stage, editMode]);

    if (!rect) return null;

    return (
        <Layer listening={false}>
            <Rect {...rect} fill="rgba(0, 120, 212, 0.15)" stroke="rgb(0, 120, 212)" strokeWidth={1} />
        </Layer>
    );
};
