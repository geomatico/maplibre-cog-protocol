import {SphericalMercator} from '@mapbox/sphericalmercator';
import type {FeatureCollection, Geometry} from 'geojson';

import {TILE_SIZE} from '../constants';
import type {TileIndex} from '../types';

const merc = new SphericalMercator({size: TILE_SIZE, antimeridian: true});

let _mask: FeatureCollection | undefined;

export const setMask = (mask: FeatureCollection | undefined): void => {
  _mask = mask;
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

export const applyMask = (rgba: Uint8ClampedArray, tileIndex: TileIndex): void => {
  if (!_mask || typeof OffscreenCanvas === 'undefined') return;

  const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imageData = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  imageData.data.set(rgba);
  ctx.putImageData(imageData, 0, 0);

  const path = new Path2D();
  for (const {geometry} of _mask.features) {
    for (const rings of ringGroups(geometry)) {
      for (const ring of rings) {
        ring.forEach((pos, i) => {
          const [cx, cy] = toTilePixel(pos, tileIndex);
          if (i === 0) path.moveTo(cx, cy);
          else path.lineTo(cx, cy);
        });
        path.closePath();
      }
    }
  }

  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = 'black';
  ctx.fill(path, 'evenodd');

  rgba.set(ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE).data);
};
