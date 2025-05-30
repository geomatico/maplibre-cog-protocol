import { TILE_SIZE } from '../constants';
import {CogMetadata, ImageRenderer, TypedArray} from '../types';

type Options = CogMetadata;

const renderTerrain: ImageRenderer<Options> = (data: TypedArray, {offset, scale, noData}) => {
  const pixels = TILE_SIZE * TILE_SIZE;
  const numBands = data.length / pixels;
  const rgba = new Uint8ClampedArray(pixels * 4);

  const base = -10000;
  const interval = 0.1;

  for (let i = 0; i < pixels; i++) {
    const px = offset + data[i * numBands] * scale;
    const h = px == noData ? 0 : px;
    const v = (h - base) / interval;
    rgba[4 * i] = Math.floor(v / 256 / 256) % 256;
    rgba[4 * i + 1] = Math.floor(v / 256) % 256;
    rgba[4 * i + 2] = v % 256;
    rgba[4 * i + 3] = 255;
  }

  return rgba;
}

export default renderTerrain;
