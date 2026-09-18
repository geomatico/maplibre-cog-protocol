import { TILE_SIZE } from '../constants';
const numPixels = TILE_SIZE * TILE_SIZE;
/**
 * Applies a COG's own alpha sample to the rendered tile, multiplying whatever transparency the
 * renderer already produced, so that it composes with a custom color function's own alpha.
 */
export const applyAlpha = (rgba, raster, { band, bitsPerSample = 8, premultiplied = false }) => {
    const bands = raster.length / numPixels;
    if (band >= bands)
        return; // the alpha sample was not read
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
