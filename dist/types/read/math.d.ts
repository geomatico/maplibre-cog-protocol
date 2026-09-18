import type { Bbox, LatLonZoom, TileCoverage, TileIndex, TilePixel } from '../types';
export declare const tileIndexToMercatorBbox: ({ x, y, z }: TileIndex) => Bbox;
export declare const mercatorBboxToGeographicBbox: ([xMin, yMin, xMax, yMax]: Bbox) => Bbox;
export declare const zoomFromResolution: (res: number) => number;
export declare const tileIndexToPixelWindow: ({ x, y, z }: TileIndex, imageBox: number[], imageWidth: number, imageHeight: number) => [number, number, number, number];
/**
 * Which tile pixels are covered by the image, given the pixel window the tile maps to. A window
 * may extend beyond the image when the tile straddles its border: those pixels hold the read
 * fillValue, not data, and are the ones this rectangle leaves out.
 */
export declare const pixelWindowToTileCoverage: ([left, top, right, bottom]: [number, number, number, number], imageWidth: number, imageHeight: number, tileSize: number) => TileCoverage;
export declare const tilePixelFromLatLonZoom: ({ latitude, longitude, zoom }: LatLonZoom) => TilePixel;
