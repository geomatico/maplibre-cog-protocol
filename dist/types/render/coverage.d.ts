import type { TileCoverage } from '../types';
/**
 * Makes transparent the tile pixels that lie outside the COG: those have no source pixel at all,
 * just the fillValue the reader asked geotiff.js for, which for integer rasters is a value like
 * any other. Coverage is geometry, so it applies whatever the COG declares as noData.
 */
export declare const applyCoverage: (rgba: Uint8ClampedArray, { left, top, right, bottom }: TileCoverage) => void;
