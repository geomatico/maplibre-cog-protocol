import SphericalMercator from '@mapbox/sphericalmercator';
import {FeatureCollection, Geometry} from 'geojson';

import {TILE_SIZE} from '../constants';
import {TileIndex} from '../types';

const merc = new SphericalMercator({size: TILE_SIZE, antimeridian: true});

let _cachedPath: Path2D | undefined;

export const setMask = (mask: FeatureCollection | undefined): void => {
  _cachedPath = undefined;
  if (!mask || typeof Path2D === 'undefined') return;

  // Precompute path in zoom-0 pixel space. At render time only a scale+translate
  // transform is needed — no per-tile vertex loop, no trig.
  const path = new Path2D();
  for (const {geometry} of mask.features) {
    for (const rings of ringGroups(geometry)) {
      for (const ring of rings) {
        ring.forEach((pos, i) => {
          const [px, py] = merc.px([pos[0], pos[1]], 0);
          if (i === 0) {
            path.moveTo(px, py);
          } else {
            path.lineTo(px, py);
          }
        });
        path.closePath();
      }
    }
  }
  _cachedPath = path;
};

export const clearMask = (): void => setMask(undefined);

// Exported for testing: converts WGS84 to tile-relative pixel coordinates.
export const toTilePixel = (pos: number[], {x, y, z}: TileIndex): [number, number] => {
  const [gpx, gpy] = merc.px([pos[0], pos[1]], z);
  return [gpx - x * TILE_SIZE, gpy - y * TILE_SIZE];
};

const ringGroups = (geometry: Geometry): number[][][][] => {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
};

export const applyMask = (rgba: Uint8ClampedArray, {x, y, z}: TileIndex): void => {
  if (!_cachedPath || typeof OffscreenCanvas === 'undefined') return;

  const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = canvas.getContext('2d')!;

  const imageData = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  imageData.data.set(rgba);
  ctx.putImageData(imageData, 0, 0);

  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = 'black';
  const scale = 2 ** z;
  ctx.setTransform(scale, 0, 0, scale, -x * TILE_SIZE, -y * TILE_SIZE);
  ctx.fill(_cachedPath, 'evenodd');

  rgba.set(ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE).data);
};
