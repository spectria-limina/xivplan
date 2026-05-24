import { Stage } from 'konva/lib/Stage';
import type { Vector2d } from 'konva/lib/types';
import { getObjectById, useScene } from './SceneProvider';
import {
    isMoveable,
    isRotateable,
    type MoveableObject,
    type RotateableObject,
    type Scene,
    type SceneObject,
} from './scene';
import { degtorad, round } from './util';
import { vecAngle } from './vector';

export const ALIGN_TO_PIXEL = {
    offsetX: -0.5,
    offsetY: -0.5,
};

export interface Position {
    readonly x: number;
    readonly y: number;
    readonly positionParentId?: number;
}

export function getCanvasX(scene: Scene, x: number): number {
    const center = scene.arena.width / 2 + scene.arena.padding;
    return center + x;
}

export function getCanvasY(scene: Scene, y: number): number {
    const center = scene.arena.height / 2 + scene.arena.padding;
    return center - y;
}

/** @returns the absolute position of the 'parent' object, or (0,0) if there is no parent. */
export function getParentPosition(scene: Scene, p: Position): Vector2d {
    const parentIdSet = new Set<number>();
    let parentId = p.positionParentId;
    const position: Vector2d = { x: 0, y: 0 };
    while (parentId !== undefined) {
        if (parentIdSet.has(parentId)) {
            console.error('cyclic positional dependency');
            return { x: 0, y: 0 };
        }
        parentIdSet.add(parentId);
        const parent = getObjectById(scene, parentId);
        if (isMoveable(parent)) {
            position.x += parent.x;
            position.y += parent.y;
            parentId = parent.positionParentId;
        } else {
            break;
        }
    }
    return position;
}

/** @returns the actual position in the scene, while taking into account any position parents. */
export function getAbsolutePosition(scene: Scene, p: Position): Vector2d {
    const parent = getParentPosition(scene, p);
    return { x: parent.x + p.x, y: parent.y + p.y };
}

export function getCanvasCoord(scene: Scene, p: Position): Vector2d {
    const absolutePos = getAbsolutePosition(scene, p);
    return { x: getCanvasX(scene, absolutePos.x), y: getCanvasY(scene, absolutePos.y) };
}

export function getCanvasSize(scene: Scene): { width: number; height: number } {
    return {
        width: scene.arena.width + scene.arena.padding * 2,
        height: scene.arena.height + scene.arena.padding * 2,
    };
}

export function getCanvasArenaRect(scene: Scene): { x: number; y: number; width: number; height: number } {
    const { x, y } = getCanvasCoord(scene, { x: -scene.arena.width / 2, y: scene.arena.height / 2 });
    const width = scene.arena.width;
    const height = scene.arena.height;

    return { x, y, width, height };
}

export function getCanvasArenaEllipse(scene: Scene): { x: number; y: number; radiusX: number; radiusY: number } {
    const { x, y } = getCanvasCoord(scene, { x: 0, y: 0 });
    const radiusX = scene.arena.width / 2;
    const radiusY = scene.arena.height / 2;

    return { x, y, radiusX, radiusY };
}

export function useCanvasCoord(p: Position): Vector2d {
    const { scene } = useScene();
    return getCanvasCoord(scene, p);
}

export function useCanvasArenaRect(): { x: number; y: number; width: number; height: number } {
    const { scene } = useScene();
    return getCanvasArenaRect(scene);
}

export function useCanvasArenaEllipse(): { x: number; y: number; radiusX: number; radiusY: number } {
    const { scene } = useScene();
    return getCanvasArenaEllipse(scene);
}

export function getSceneX(scene: Scene, x: number): number {
    const center = scene.arena.width / 2 + scene.arena.padding;
    return x - center;
}

export function getSceneY(scene: Scene, y: number): number {
    const center = scene.arena.height / 2 + scene.arena.padding;
    return center - y;
}

export function getSceneCoord(scene: Scene, p: Position): Vector2d {
    const absolutePos = getAbsolutePosition(scene, p);
    return round({ x: getSceneX(scene, absolutePos.x), y: getSceneY(scene, absolutePos.y) });
}

/**
 * @returns the given [p], as a position relative to the object with the given [positionParentId] id
 */
export function makeRelative(scene: Scene, p: Vector2d, positionParentId?: number): Vector2d {
    const parent = getParentPosition(scene, { x: 0, y: 0, positionParentId });
    return { x: p.x - parent.x, y: p.y - parent.y };
}

/** @returns the angle that is considered '0 degrees rotated' for the given object. */
export function getBaseFacingRotation(scene: Scene, object: RotateableObject & MoveableObject): number {
    if (object.facingId !== undefined) {
        const facingObject = getObjectById(scene, object.facingId);
        if (facingObject && isMoveable(facingObject)) {
            return getRotationToFaceTarget(scene, object, facingObject);
        }
    }
    return 0;
}

/** Calculates the rotation of the object while taking into account the object it may be configured to be facing. */
export function getAbsoluteRotation(scene: Scene, object: RotateableObject & MoveableObject): number {
    return getBaseFacingRotation(scene, object) + object.rotation;
}

/** @returns the angle to rotate an up-facing object at the given origin to make it face towards the target (in degrees) */
function getRotationToFaceTarget(
    scene: Scene,
    origin: MoveableObject & RotateableObject,
    target: SceneObject & MoveableObject,
): number {
    // If the origin is _also_ attached to the target positionally and _also_ on exactly the same location, face the same
    // direction as the target instead of whatever arbitrary direction the (0,0) vector yields.
    // Positional connections are guaranteed to not have a circular dependency [without manual editing of the plan files].
    if (origin.positionParentId === target.id && origin.x == 0 && origin.y == 0 && isRotateable(target)) {
        return getAbsoluteRotation(scene, target);
    }
    const originPosition = getAbsolutePosition(scene, origin);
    const targetPosition = getAbsolutePosition(scene, target);

    return getPointerAngle({ x: targetPosition.x - originPosition.x, y: targetPosition.y - originPosition.y });
}

export function rotateCoord(p: Vector2d, angle: number, center: Vector2d = { x: 0, y: 0 }): Vector2d {
    const cos = Math.cos(degtorad(-angle));
    const sin = Math.sin(degtorad(-angle));

    const offsetX = p.x - center.x;
    const offsetY = p.y - center.y;
    const rotatedX = offsetX * cos - offsetY * sin;
    const rotatedY = offsetX * sin + offsetY * cos;

    return { x: center.x + rotatedX, y: center.y + rotatedY };
}

export function snapAngle(angle: number, snapDivision: number, snapTolerance: number): number {
    const divAngle = ((angle % snapDivision) + snapDivision) % snapDivision;

    if (divAngle > snapTolerance && divAngle < snapDivision - snapTolerance) {
        return angle;
    }

    return Math.round(angle / snapDivision) * snapDivision;
}

export function getPointerAngle(pos: Vector2d): number {
    return vecAngle(pos);
}

export function getPointerPosition(scene: Scene, stage: Stage | undefined | null): Vector2d | null {
    const pos = stage?.getPointerPosition();
    if (!pos) {
        return null;
    }
    return getSceneCoord(scene, pos);
}

export interface Circle {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
}

/**
 * @returns whether point [p] is within (or on the edge of) circle [c]
 */
export function isWithinRadius(c: Circle, p: Vector2d): boolean {
    const distanceSq = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
    return distanceSq <= c.radius ** 2;
}

export interface Box {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/**
 * @returns whether point [p] is within (or on the edge of) box [b]
 */
export function isWithinBox(b: Box, p: Vector2d): boolean {
    return Math.abs(p.x - b.x) <= b.width / 2 && Math.abs(p.y - b.y) <= b.height / 2;
}

// ─── Rect: top-left-anchored AABB used by drag selection ──────────────────────
// Note the different anchor from Box (which is center-anchored).

export interface Rect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

export function isWithinRect(r: Rect, p: Vector2d): boolean {
    return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

/** Closest-point-on-rect distance test. */
export function rectIntersectsCircle(r: Rect, c: Circle): boolean {
    const cx = Math.max(r.x, Math.min(c.x, r.x + r.width));
    const cy = Math.max(r.y, Math.min(c.y, r.y + r.height));
    const dx = c.x - cx;
    const dy = c.y - cy;
    return dx * dx + dy * dy <= c.radius * c.radius;
}

/**
 * SAT test against a rotated rectangle defined by its center, half-extents,
 * and clockwise rotation in degrees (canvas convention, +y down).
 */
export function rectIntersectsRotatedRect(
    r: Rect,
    center: Vector2d,
    halfW: number,
    halfH: number,
    rotDeg: number,
): boolean {
    return rectIntersectsOffsetRotatedRect(r, center, -halfW, -halfH, halfW * 2, halfH * 2, rotDeg);
}

/**
 * SAT test against a rotated rectangle whose unrotated top-left corner (relative
 * to [center]) is at (offsetX, offsetY), with the given width/height.
 */
export function rectIntersectsOffsetRotatedRect(
    r: Rect,
    center: Vector2d,
    offsetX: number,
    offsetY: number,
    width: number,
    height: number,
    rotDeg: number,
): boolean {
    const rad = degtorad(rotDeg);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const corners: Vector2d[] = (
        [
            [offsetX, offsetY],
            [offsetX + width, offsetY],
            [offsetX + width, offsetY + height],
            [offsetX, offsetY + height],
        ] as const
    ).map(([lx, ly]) => ({
        x: center.x + lx * cos - ly * sin,
        y: center.y + lx * sin + ly * cos,
    }));
    return rectIntersectsConvexPolygon(r, corners);
}

/** SAT test between [r] and a convex polygon defined by its vertices. */
export function rectIntersectsConvexPolygon(r: Rect, poly: readonly Vector2d[]): boolean {
    if (poly.length < 2) return false;
    const rpts: Vector2d[] = [
        { x: r.x, y: r.y },
        { x: r.x + r.width, y: r.y },
        { x: r.x + r.width, y: r.y + r.height },
        { x: r.x, y: r.y + r.height },
    ];
    if (!satOverlap(rpts, poly, { x: 1, y: 0 })) return false;
    if (!satOverlap(rpts, poly, { x: 0, y: 1 })) return false;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i]!;
        const b = poly[(i + 1) % poly.length]!;
        const ax = { x: -(b.y - a.y), y: b.x - a.x };
        if (!satOverlap(rpts, poly, ax)) return false;
    }
    return true;
}

/** Test whether [r] overlaps a circular sector with its tip at [center]. */
export function rectIntersectsWedge(
    r: Rect,
    center: Vector2d,
    radius: number,
    startDeg: number,
    endDeg: number,
): boolean {
    const sweep = normDeg(endDeg - startDeg);
    if (sweep >= 359.999) return rectIntersectsCircle(r, { x: center.x, y: center.y, radius });
    if (!rectIntersectsCircle(r, { x: center.x, y: center.y, radius })) return false;
    if (isWithinRect(r, center)) return true;

    const rpts: Vector2d[] = [
        { x: r.x, y: r.y },
        { x: r.x + r.width, y: r.y },
        { x: r.x + r.width, y: r.y + r.height },
        { x: r.x, y: r.y + r.height },
    ];
    for (const p of rpts) {
        if (ptInWedge(p, center, radius, startDeg, sweep)) return true;
    }

    const p0 = polar(center, radius, startDeg);
    const p1 = polar(center, radius, endDeg);
    if (isWithinRect(r, p0) || isWithinRect(r, p1)) return true;

    for (let i = 0; i < 4; i++) {
        const ea = rpts[i]!;
        const eb = rpts[(i + 1) % 4]!;
        if (segsIntersect(ea, eb, center, p0) || segsIntersect(ea, eb, center, p1)) return true;
    }

    // Sample the arc for sliver cases.
    const steps = Math.max(8, Math.ceil(sweep / 5));
    for (let i = 1; i < steps; i++) {
        if (isWithinRect(r, polar(center, radius, startDeg + (sweep * i) / steps))) return true;
    }
    return false;
}

/** Test whether [r] overlaps an annulus (ring) centered at [c]. */
export function rectIntersectsAnnulus(r: Rect, c: Vector2d, outerR: number, innerR: number): boolean {
    if (!rectIntersectsCircle(r, { x: c.x, y: c.y, radius: outerR })) return false;
    if (innerR <= 0) return true;
    // If every rect corner is strictly inside the inner hole, no overlap.
    const rpts: Vector2d[] = [
        { x: r.x, y: r.y },
        { x: r.x + r.width, y: r.y },
        { x: r.x + r.width, y: r.y + r.height },
        { x: r.x, y: r.y + r.height },
    ];
    return rpts.some((p) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2 > innerR * innerR);
}

/** Test whether [r] overlaps an annular sector (donut wedge). */
export function rectIntersectsAnnularSector(
    r: Rect,
    center: Vector2d,
    outerR: number,
    innerR: number,
    startDeg: number,
    endDeg: number,
): boolean {
    const sweep = normDeg(endDeg - startDeg);
    if (sweep >= 359.999) return rectIntersectsAnnulus(r, center, outerR, innerR);

    // Quick reject: rect doesn't reach outer circle
    if (!rectIntersectsCircle(r, { x: center.x, y: center.y, radius: outerR })) return false;

    // Quick reject: rect entirely inside inner circle (every corner inside)
    if (innerR > 0) {
        const rpts = rectPts(r);
        if (rpts.every((p) => (p.x - center.x) ** 2 + (p.y - center.y) ** 2 <= innerR * innerR)) {
            return false;
        }
    }

    // The sector has no tip — its boundary is two arcs + two radial segments.
    // Test each boundary element against the rect.

    // Radial segments (innerR → outerR at each bounding angle)
    const safeInner = Math.max(innerR, 0);
    const p0i = polar(center, safeInner, startDeg);
    const p0o = polar(center, outerR, startDeg);
    const p1i = polar(center, safeInner, endDeg);
    const p1o = polar(center, outerR, endDeg);
    if (rectIntersectsSegment(r, p0i, p0o)) return true;
    if (rectIntersectsSegment(r, p1i, p1o)) return true;

    // Sample both arcs
    const steps = Math.max(8, Math.ceil(sweep / 5));
    for (let i = 0; i <= steps; i++) {
        const a = startDeg + (sweep * i) / steps;
        if (isWithinRect(r, polar(center, outerR, a))) return true;
        if (innerR > 0 && isWithinRect(r, polar(center, innerR, a))) return true;
    }

    // Check whether a rect corner lies in the annular sector
    for (const p of rectPts(r)) {
        const dx = p.x - center.x;
        const dy = p.y - center.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < safeInner * safeInner || d2 > outerR * outerR) continue;
        if (normDeg((Math.atan2(dy, dx) * 180) / Math.PI - startDeg) <= sweep) return true;
    }

    return false;
}

function rectPts(r: Rect): Vector2d[] {
    return [
        { x: r.x, y: r.y },
        { x: r.x + r.width, y: r.y },
        { x: r.x + r.width, y: r.y + r.height },
        { x: r.x, y: r.y + r.height },
    ];
}

/** Test whether [r] overlaps the line segment from [a] to [b]. */
export function rectIntersectsSegment(r: Rect, a: Vector2d, b: Vector2d): boolean {
    if (isWithinRect(r, a) || isWithinRect(r, b)) return true;
    const rpts: Vector2d[] = [
        { x: r.x, y: r.y },
        { x: r.x + r.width, y: r.y },
        { x: r.x + r.width, y: r.y + r.height },
        { x: r.x, y: r.y + r.height },
    ];
    for (let i = 0; i < 4; i++) {
        if (segsIntersect(a, b, rpts[i]!, rpts[(i + 1) % 4]!)) return true;
    }
    return false;
}

// ─── Internal geometry helpers ────────────────────────────────────────────────

function satOverlap(a: readonly Vector2d[], b: readonly Vector2d[], axis: Vector2d): boolean {
    let aMin = Infinity,
        aMax = -Infinity,
        bMin = Infinity,
        bMax = -Infinity;
    for (const p of a) {
        const v = p.x * axis.x + p.y * axis.y;
        if (v < aMin) aMin = v;
        if (v > aMax) aMax = v;
    }
    for (const p of b) {
        const v = p.x * axis.x + p.y * axis.y;
        if (v < bMin) bMin = v;
        if (v > bMax) bMax = v;
    }
    return !(aMax < bMin || bMax < aMin);
}

function normDeg(d: number) {
    return ((d % 360) + 360) % 360;
}

function polar(c: Vector2d, r: number, deg: number): Vector2d {
    const rad = degtorad(deg);
    return { x: c.x + r * Math.cos(rad), y: c.y + r * Math.sin(rad) };
}

function ptInWedge(p: Vector2d, tip: Vector2d, radius: number, startDeg: number, sweepDeg: number): boolean {
    const dx = p.x - tip.x,
        dy = p.y - tip.y;
    if (dx * dx + dy * dy > radius * radius) return false;
    return normDeg((Math.atan2(dy, dx) * 180) / Math.PI - startDeg) <= sweepDeg;
}

function segsIntersect(a: Vector2d, b: Vector2d, c: Vector2d, d: Vector2d): boolean {
    const denom = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
    if (denom === 0) return false;
    const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denom;
    const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denom;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
