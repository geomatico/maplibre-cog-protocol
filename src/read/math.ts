import SphericalMercator from '@mapbox/sphericalmercator';

import {Bbox, TileIndex} from '@/types';

const TILE_SIZE = 256;
const MAX_EXTENT = 2 * 20037508.342789244;

const merc = new SphericalMercator({
  size: TILE_SIZE,
  antimeridian: true
});

export const tileIndexToMercatorBbox = ({x, y, z}: TileIndex): Bbox =>
  merc.bbox(x, y, z, false, '900913');

export const mercatorBboxToGeographicBbox = ([xMin, yMin, xMax, yMax]: Bbox): Bbox =>
  ([...merc.inverse([xMin, yMin]), ...merc.inverse([xMax, yMax])]);

export const zoomFromResolution = (res: number): number =>
  Math.log2(MAX_EXTENT / (TILE_SIZE * res));
