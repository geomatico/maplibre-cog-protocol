import type { FeatureCollection } from 'geojson';
import type { TileIndex } from '../types';
export declare const setMask: (mask: FeatureCollection | undefined) => void;
export declare const clearMask: () => void;
export declare const toTilePixel: (pos: number[], { x, y, z }: TileIndex) => [number, number];
/**
 * Whether a position falls outside the user mask, and is therefore not drawn. Works on the geometry
 * itself, with the even-odd rule `applyMask` fills its path with, so a value query and the rendered
 * tile agree. Without a mask set, nothing is masked out.
 */
export declare const isMaskedOut: (position: number[], tileIndex: TileIndex) => boolean;
export declare const applyMask: (rgba: Uint8ClampedArray, tileIndex: TileIndex) => void;
