import type { FeatureCollection } from 'geojson';
import type { TileIndex } from '../types';
export declare const setMask: (mask: FeatureCollection | undefined) => void;
export declare const clearMask: () => void;
export declare const toTilePixel: (pos: number[], { x, y, z }: TileIndex) => [number, number];
export declare const applyMask: (rgba: Uint8ClampedArray, tileIndex: TileIndex) => void;
