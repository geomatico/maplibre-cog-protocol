import { Bbox, LatLonZoom, TileIndex, TilePixel } from '@/types';
export declare const tileIndexToMercatorBbox: ({ x, y, z }: TileIndex) => Bbox;
export declare const mercatorBboxToGeographicBbox: ([xMin, yMin, xMax, yMax]: Bbox) => Bbox;
export declare const zoomFromResolution: (res: number) => number;
export declare const tilePixelFromLatLonZoom: ({ latitude, longitude, zoom }: LatLonZoom) => TilePixel;
