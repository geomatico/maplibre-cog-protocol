import {TILE_SIZE} from '../constants';
import type {CogMetadata, ImageRenderer, TypedArray} from '../types';
import {type ColorScaleParams, colorScale} from './colorScale';

type Options = CogMetadata & {colorScale: ColorScaleParams};

const renderColor: ImageRenderer<Options> = (
  data: TypedArray,
  {offset, scale, noData, colorScale: colorScaleParams},
) => {
  const pixels = TILE_SIZE * TILE_SIZE;
  const numBands = data.length / pixels;
  const rgba = new Uint8ClampedArray(pixels * 4);
  const interpolate = colorScale(colorScaleParams);

  for (let i = 0; i < pixels; i++) {
    const px = offset + data[i * numBands] * scale;
    if (px === noData || Number.isNaN(px) || px === Infinity) {
      rgba[4 * i] = 0;
      rgba[4 * i + 1] = 0;
      rgba[4 * i + 2] = 0;
      rgba[4 * i + 3] = 0;
    } else {
      const color = interpolate(px);
      rgba[4 * i] = color[0];
      rgba[4 * i + 1] = color[1];
      rgba[4 * i + 2] = color[2];
      rgba[4 * i + 3] = 255;
    }
  }
  return rgba;
};

export default renderColor;
