import type { GeoTIFFImage, Pool } from 'geotiff';
import type { TypedArray } from '../types';
type ReadTileOptions = {
    window: [number, number, number, number];
    width: number;
    height: number;
    fillValue: number;
    pool: Pool;
};
/**
 * Reads an interleaved raster for a pixel window, copying whole pixels between typed arrays.
 *
 * geotiff.js' own `readRasters` reads every sample of every pixel through a DataView call, which
 * for a COG with many bands costs more than decompressing the tile: 8.3 million calls, around
 * 200 ms, for a 256x256 window of a 127 band image, where the copy below takes about 3 ms.
 *
 * Returns undefined when the image is not laid out in a way this shortcut handles, leaving the
 * caller to fall back on `readRasters`.
 */
export declare const readTileFast: (image: GeoTIFFImage, { window: [left, top, right, bottom], width, height, fillValue, pool }: ReadTileOptions) => Promise<TypedArray | undefined>;
export {};
