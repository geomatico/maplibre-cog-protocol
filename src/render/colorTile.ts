import { TypedArray } from 'geotiff';
import { ColorFunction, RendererMetadata, RGBAValue } from '../types';

/**
 * Colors all pixels in a tile using a provided color function.
 */
export function colorTile(data: TypedArray[], metadata: RendererMetadata, colorPixel: ColorFunction): Uint8ClampedArray {
  const { zoomLevelMetadata, x, y, z, tileSize, maskData } = metadata;
  const pixels = data[0].length;
  const rgba = new Uint8ClampedArray(pixels * 4);

  if (maskData) {
    const zoomMetadata = zoomLevelMetadata.get(z);

    if (!zoomMetadata) {
      throw new Error(`No zoom metadata found for zoom level ${z}`);
    }

    /**
     * Explanation of offsets:
     *
     * The loops below loop over each row and each column within each row for this tile, meaning the pixel indexes processed will range
     * from 0 to tileSize * tileSize.
     *
     * The mask data provided by geomask isn't tiled, and there for the ranges of pixels to render are for every tile that makes up the
     * GeoTiff. The offsets are used to calculate the pixel index within all the tiles so that it can check the mask to see if that pixel
     * should be rendered.
     *
     * For example consider that the tile size is 3x3, the pixel indexes would be:
     * _________
     * | 0 1 2 |
     * | 3 4 5 |
     * | 6 7 8 |
     * ‾‾‾‾‾‾‾‾‾
     *
     * If the GeoTiff loaded spans 3 columns and 2 rows it would look like:
     *
     * _________________________
     * | 0 1 2 | 0 1 2 | 0 1 2 |
     * | 3 4 5 | 3 4 5 | 3 4 5 |
     * | 6 7 8 | 6 7 8 | 6 7 8 |
     * ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾
     * | 0 1 2 | 0 1 2 | 0 1 2 |
     * | 3 4 5 | 3 4 5 | 3 4 5 |
     * | 6 7 8 | 6 7 8 | 6 7 8 |
     * ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾
     *
     * geomask works with the entire raster and returns a multi-dimensional array where each row includes the ranges of pixels inside
     * the mask. This means if we are currently rendering the 3rd tile in the 2nd row of tiles shown above, we need to offset the row index
     * by 1 tile worth of rows (i.e. 3), and the column index 2 tiles worth of columns (i.e. 6) to check whether the pixel being processed
     * is within the mask.
     */

    const offsetY = y - zoomMetadata.y;
    const rowOffset = offsetY * tileSize;

    const offsetX = x - zoomMetadata.x;
    const columnOffset = offsetX * tileSize;

    for (let rowIndex = 0; rowIndex < tileSize; rowIndex++) {
      const rowMaskRange: number[][] | undefined = maskData[rowIndex + rowOffset];

      // If there is no masking range for the current row we can skip rendering the entire row.
      if (!rowMaskRange) {
        continue;
      }

      for (let columnIndex = 0; columnIndex < tileSize; columnIndex++) {
        const pixelIndex = rowIndex * tileSize + columnIndex;
        const offsetColumnIndex = columnIndex + columnOffset;

        // If the offset column index exists between the minimum column index and the maximum column index, we can render this pixel.
        if (rowMaskRange?.some(([minColIndex, maxColIndex]) => offsetColumnIndex >= minColIndex && offsetColumnIndex <= maxColIndex)) {
          renderPixel(pixelIndex, data, metadata, rgba, colorPixel);
        }
      }
    }
  } else {
    // No mask, just loop over all the pixels
    for (let pixelIndex = 0; pixelIndex < pixels; pixelIndex++) {
      renderPixel(pixelIndex, data, metadata, rgba, colorPixel);
    }
  }

  return rgba;
}

function renderPixel(
  pixelIndex: number,
  data: TypedArray[],
  { offset, scale }: RendererMetadata,
  rgba: RGBAValue,
  colorPixel: ColorFunction
): void {
  const px = data.map((band) => offset + band[pixelIndex] * scale);

  colorPixel(px, rgba.subarray(4 * pixelIndex, 4 * pixelIndex + 4));
}
