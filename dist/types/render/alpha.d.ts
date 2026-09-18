import type { TypedArray } from '../types';
type AlphaOptions = {
    /** Index of the sample holding alpha, within each pixel. */
    band: number;
    /** Bit depth of that sample, to bring it into the 0..255 range. */
    bitsPerSample?: number;
    /** TIFF associated alpha: the color samples are premultiplied and have to be restored. */
    premultiplied?: boolean;
};
/**
 * Applies a COG's own alpha sample to the rendered tile, multiplying whatever transparency the
 * renderer already produced, so that it composes with a custom color function's own alpha.
 */
export declare const applyAlpha: (rgba: Uint8ClampedArray, raster: TypedArray, { band, bitsPerSample, premultiplied }: AlphaOptions) => void;
export {};
