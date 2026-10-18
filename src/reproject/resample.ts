import {TILE_SIZE} from '../constants';
import type {TypedArray} from '../types';
import type {TileMapping} from './tileMapping';

/** A window larger than this, in pixels per side, is read decimated: the tile only has 256. */
const MAX_READ_SIZE = 1024;

export type SourceWindow = {
  /** [left, top, right, bottom], in pixels of the image, always inside it. */
  window: [number, number, number, number];
  /** Size of the raster to read for the window. Equal to the window unless it is decimated. */
  width: number;
  height: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * The part of an image a tile draws from, given the tile's `bounds` as fractions of the extent.
 * Undefined when the tile does not touch the image.
 */
export const sourceWindow = (
  [uMin, vMin, uMax, vMax]: [number, number, number, number],
  imageWidth: number,
  imageHeight: number,
): SourceWindow | undefined => {
  // One pixel of margin, so rounding never leaves the last row or column of the tile short
  const left = clamp(Math.floor(uMin * imageWidth) - 1, 0, imageWidth);
  const right = clamp(Math.ceil(uMax * imageWidth) + 1, 0, imageWidth);
  const top = clamp(Math.floor(vMin * imageHeight) - 1, 0, imageHeight);
  const bottom = clamp(Math.ceil(vMax * imageHeight) + 1, 0, imageHeight);
  if (right <= left || bottom <= top) return undefined;

  const decimation = Math.max(1, Math.ceil(Math.max(right - left, bottom - top) / MAX_READ_SIZE));
  return {
    window: [left, top, right, bottom],
    width: Math.ceil((right - left) / decimation),
    height: Math.ceil((bottom - top) / decimation),
  };
};

/**
 * Builds the 256 x 256 tile from a raster read for its source window, taking for every tile pixel
 * the nearest source pixel (same as the library does for COGs that need no reprojection).
 *
 * @param raster Interleaved pixels of the window, `width * height * samples` values.
 * @param tile Where to write, interleaved, `256 * 256 * samples` values of the same type as `raster`.
 *   Pixels outside the COG are left as they are, so it should come filled with the fill value.
 */
export const sampleTile = (
  {u, v, footprint}: TileMapping,
  raster: TypedArray,
  {window: [left, top, right, bottom], width, height}: SourceWindow,
  imageWidth: number,
  imageHeight: number,
  tile: TypedArray,
): TypedArray => {
  const samples = tile.length / (TILE_SIZE * TILE_SIZE);

  const ratioX = (right - left) / width; // 1, unless the window was decimated
  const ratioY = (bottom - top) / height;

  for (let i = 0; i < footprint.length; i++) {
    if (footprint[i] === 0) continue;

    const column = clamp(Math.floor((u[i] * imageWidth - left) / ratioX), 0, width - 1);
    const row = clamp(Math.floor((v[i] * imageHeight - top) / ratioY), 0, height - 1);

    const from = (row * width + column) * samples;
    const to = i * samples;
    for (let sample = 0; sample < samples; sample++) {
      tile[to + sample] = raster[from + sample];
    }
  }
  return tile;
};
