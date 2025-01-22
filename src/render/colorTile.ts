import { TypedArray } from 'geotiff';
import { TILE_SIZE } from '../constants';
import { CogMetadata, ColorFunction } from '../types';

/**
 * Colors all pixels in a tile using a provided color function.
 */
export function colorTile(data: TypedArray[], metadata: CogMetadata, colorPixel: ColorFunction): Uint8ClampedArray {
  const { offset, scale } = metadata;
  const pixels = data[0].length;
  const rgba = new Uint8ClampedArray(pixels * 4);

  for (let rowIndex = 0; rowIndex < TILE_SIZE; rowIndex++) {
    for (let columnIndex = 0; columnIndex < TILE_SIZE; columnIndex++) {
      const pixelIndex = rowIndex * TILE_SIZE + columnIndex;
      const px = data.map((band) => offset + band[pixelIndex] * scale);

      colorPixel(px, rgba.subarray(4 * pixelIndex, 4 * pixelIndex + 4));
    }
  }

  return rgba;
}
