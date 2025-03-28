import SphericalMercator from '@mapbox/sphericalmercator';

import { TILE_SIZE } from '../constants';
import { Bbox, LatLonZoom, TileIndex, TilePixel, XYBounds } from '../types';

const MAX_EXTENT = 2 * 20037508.342789244;

const mercator = new SphericalMercator({
  size: TILE_SIZE,
  antimeridian: true,
});

export const tileIndexToMercatorBbox = ({ x, y, z }: TileIndex): Bbox => mercator.bbox(x, y, z, false, '900913');

export const imageBboxToTileBounds = (bbox: Bbox, zoom: number) => mercator.xyz(bbox, zoom, false, '900913') as XYBounds;

export const xyBoundsToGeographicBbox = ({ minX, minY, maxX, maxY }: XYBounds, zoom: number): Bbox => {
  const topLeft = mercator.forward(mercator.ll([minX * TILE_SIZE, minY * TILE_SIZE], zoom));
  const bottomRight = mercator.forward(mercator.ll([(maxX + 1) * TILE_SIZE, (maxY + 1) * TILE_SIZE], zoom));

  return [topLeft[0], bottomRight[1], bottomRight[0], topLeft[1]];
};

export const mercatorBboxToGeographicBbox = ([xMin, yMin, xMax, yMax]: Bbox): Bbox => [
  ...mercator.inverse([xMin, yMin]),
  ...mercator.inverse([xMax, yMax]),
];

export const zoomFromResolution = (res: number): number => Math.log2(MAX_EXTENT / (TILE_SIZE * res));

export const tilePixelFromLatLonZoom = ({ latitude, longitude, zoom }: LatLonZoom): TilePixel => {
  const [mercatorX, mercatorY] = mercator.forward([longitude, latitude]);

  const pixelX = ((mercatorX + MAX_EXTENT / 2) / MAX_EXTENT) * TILE_SIZE * 2 ** zoom;
  const pixelY = (-(mercatorY - MAX_EXTENT / 2) / MAX_EXTENT) * TILE_SIZE * 2 ** zoom;

  return {
    tileIndex: {
      z: zoom,
      x: Math.floor(pixelX / TILE_SIZE),
      y: Math.floor(pixelY / TILE_SIZE),
    },
    row: Math.floor(pixelY % TILE_SIZE),
    column: Math.floor(pixelX % TILE_SIZE),
  };
};
