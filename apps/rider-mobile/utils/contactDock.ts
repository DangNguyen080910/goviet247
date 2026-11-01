export const CONTACT_DOCK_WIDTH = 152;
export const CONTACT_DOCK_HEIGHT = 124;
export type DockPoint = {
  x: number;
  y: number;
};
export function constrainContactDock(point: Partial<DockPoint> | null, width: number, height: number, top: number, bottom: number, snap = false, dockHeight = CONTACT_DOCK_HEIGHT): DockPoint {
  const minX = 16,
    maxX = Math.max(minX, width - CONTACT_DOCK_WIDTH - 16);
  const minY = Math.min(top + 72, Math.max(top + 8, height - bottom - dockHeight - 8));
  const maxY = Math.max(minY, height - bottom - 96 - dockHeight);
  let x = Number.isFinite(point?.x) ? point!.x! : maxX;
  let y = Number.isFinite(point?.y) ? point!.y! : maxY;
  x = Math.min(maxX, Math.max(minX, x));
  y = Math.min(maxY, Math.max(minY, y));
  if (snap) x = x + CONTACT_DOCK_WIDTH / 2 < width / 2 ? minX : maxX;
  return {
    x,
    y
  };
}
