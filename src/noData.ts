import type {TypedArray} from './types';

/**
 * Tests a raw sample value, as stored in the file, against the COG's noData value.
 */
export type NoDataTest = (value: number) => boolean;

const NOTHING_IS_NO_DATA: NoDataTest = () => false;

/**
 * Builds the noData test for a raster, once per tile, so that the per-pixel loops stay branch-light.
 *
 * Comparing with `===` is not enough:
 * - An undeclared noData means no pixel is noData, as in GDAL.
 * - `NaN === NaN` is false, so a `GDAL_NODATA` of NaN needs its own test.
 * - A Float32Array holds values rounded to the nearest float32, so the value read back from a COG
 *   declaring noData -9999.1 is -9999.099609375. The target has to be rounded the same way.
 * - A value the raster type cannot hold, such as -9999 in a Uint8Array, simply never matches.
 */
export const noDataTest = (noData: number | undefined, data: TypedArray): NoDataTest => {
  if (noData === undefined) return NOTHING_IS_NO_DATA;
  if (Number.isNaN(noData)) return (value) => Number.isNaN(value);

  const target = data instanceof Float32Array ? Math.fround(noData) : noData;
  return (value) => value === target;
};

/**
 * Reads the GDAL_NODATA tag, an ASCII string GDAL writes with its own formatting of the value.
 * `Number()` gets "nan" right only by accident (anything unparsable is NaN), and gets the infinite
 * values wrong, so those are handled here.
 */
export const parseNoData = (tagValue: string | undefined): number | undefined => {
  if (tagValue === undefined) return undefined;

  const text = tagValue.replace(/\0+$/, '').trim().toLowerCase();
  if (text === 'nan') return NaN;
  if (text === 'inf' || text === '+inf' || text === 'infinity' || text === '+infinity') return Infinity;
  if (text === '-inf' || text === '-infinity') return -Infinity;

  const value = Number(text);
  return Number.isNaN(value) ? undefined : value; // unparsable: as good as no noData at all
};
