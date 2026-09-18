import {TILE_SIZE} from '../constants';
import type {TypedArray} from '../types';

const numPixels = TILE_SIZE * TILE_SIZE;

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
export const applyAlpha = (
  rgba: Uint8ClampedArray,
  raster: TypedArray,
  {band, bitsPerSample = 8, premultiplied = false}: AlphaOptions,
): void => {
  const bands = raster.length / numPixels;
  if (band >= bands) return; // the alpha sample was not read

  const max = 2 ** bitsPerSample - 1;

  for (let i = 0; i < numPixels; i++) {
    const alpha = (raster[i * bands + band] / max) * 255;

    if (premultiplied && alpha > 0 && alpha < 255) {
      const factor = 255 / alpha;
      rgba[i * 4] *= factor;
      rgba[i * 4 + 1] *= factor;
      rgba[i * 4 + 2] *= factor;
    }

    rgba[i * 4 + 3] = (rgba[i * 4 + 3] * alpha) / 255;
  }
};
