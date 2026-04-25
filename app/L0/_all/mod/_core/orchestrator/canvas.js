import { CAMERA_DEFAULT, CAMERA_MAX_ZOOM, CAMERA_MIN_ZOOM } from "./constants.js";

export function clampZoom(value) {
  const zoom = Number(value);
  if (!Number.isFinite(zoom)) return CAMERA_DEFAULT.zoom;
  return Math.min(CAMERA_MAX_ZOOM, Math.max(CAMERA_MIN_ZOOM, Math.round(zoom * 1000) / 1000));
}

export function createCamera(source = {}) {
  return {
    x: normalizeNumber(source.x, CAMERA_DEFAULT.x),
    y: normalizeNumber(source.y, CAMERA_DEFAULT.y),
    zoom: clampZoom(source.zoom ?? CAMERA_DEFAULT.zoom)
  };
}

export function canvasToWorld(camera, clientX, clientY) {
  const normalizedCamera = createCamera(camera);
  return {
    x: round((Number(clientX) - normalizedCamera.x) / normalizedCamera.zoom),
    y: round((Number(clientY) - normalizedCamera.y) / normalizedCamera.zoom)
  };
}

export function worldToCanvas(camera, worldX, worldY) {
  const normalizedCamera = createCamera(camera);
  return {
    x: round(Number(worldX) * normalizedCamera.zoom + normalizedCamera.x),
    y: round(Number(worldY) * normalizedCamera.zoom + normalizedCamera.y)
  };
}

export function createZoomedCamera({ camera, nextZoom, pointerX, pointerY }) {
  const current = createCamera(camera);
  const worldPoint = canvasToWorld(current, pointerX, pointerY);
  const zoom = clampZoom(nextZoom);

  return createCamera({
    x: Number(pointerX) - worldPoint.x * zoom,
    y: Number(pointerY) - worldPoint.y * zoom,
    zoom
  });
}

function normalizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? round(number) : fallback;
}

function round(value) {
  return Math.round(value * 100) / 100;
}
