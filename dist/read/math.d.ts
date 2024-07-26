import { Bbox, TileIndex } from '@/types';
export declare const tileIndexToMercatorBbox: ({ x, y, z }: TileIndex) => Bbox;
export declare const mercatorBboxToGeographicBbox: ([xMin, yMin, xMax, yMax]: Bbox) => Bbox;
export declare const zoomFromResolution: (res: number) => number;
