import SphericalMercator from '@mapbox/sphericalmercator';

import type {Bbox, LatLonZoom, TileIndex, TilePixel} from '../types';

const TILE_SIZE = 256;
const MAX_EXTENT = 2 * 20037508.342789244;

const merc = new SphericalMercator({
  size: TILE_SIZE,
  antimeridian: true,
});

export const tileIndexToMercatorBbox = ({x, y, z}: TileIndex): Bbox => merc.bbox(x, y, z, false, '900913');

export const mercatorBboxToGeographicBbox = ([xMin, yMin, xMax, yMax]: Bbox): Bbox => [
  ...merc.inverse([xMin, yMin]),
  ...merc.inverse([xMax, yMax]),
];

export const zoomFromResolution = (res: number): number => Math.log2(MAX_EXTENT / (TILE_SIZE * res));

export const tileIndexToPixelWindow = (
  {x, y, z}: TileIndex,
  imageBox: number[],
  imageWidth: number,
  imageHeight: number,
): [number, number, number, number] => {
  const [west, south, east, north] = tileIndexToMercatorBbox({x, y, z});
  const scaleX = imageWidth / (imageBox[2] - imageBox[0]);
  const scaleY = imageHeight / (imageBox[3] - imageBox[1]);
  return [
    Math.round((west - imageBox[0]) * scaleX),
    Math.round((imageBox[3] - north) * scaleY),
    Math.round((east - imageBox[0]) * scaleX),
    Math.round((imageBox[3] - south) * scaleY),
  ];
};

export const tilePixelFromLatLonZoom = ({latitude, longitude, zoom}: LatLonZoom): TilePixel => {
  const [mercatorX, mercatorY] = merc.forward([longitude, latitude]);

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
