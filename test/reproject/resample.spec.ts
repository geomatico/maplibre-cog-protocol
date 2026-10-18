import {describe, expect, test} from 'vitest';

import {TILE_SIZE} from '../../src/constants';
import {sampleTile, sourceWindow} from '../../src/reproject/resample';
import type {TileMapping} from '../../src/reproject/tileMapping';

describe('sourceWindow', () => {
  test('is the area of the image a tile draws from, with a pixel of margin', () => {
    expect(sourceWindow([0.25, 0.5, 0.5, 0.75], 1000, 1000)).toEqual({
      window: [249, 499, 501, 751],
      width: 252,
      height: 252,
    });
  });

  test('never leaves the image', () => {
    expect(sourceWindow([0, 0, 0.9999999, 1], 100, 80)?.window).toEqual([0, 0, 100, 80]);
  });

  test('is read decimated when much larger than a tile, to keep low zoom tiles cheap', () => {
    const {window, width, height} = sourceWindow([0, 0, 1, 0.5], 4096, 4096)!;
    expect(window).toEqual([0, 0, 4096, 2049]);
    expect(width).toBe(1024);
    expect(height).toBe(513);
  });

  test('is undefined when the tile does not touch the image', () => {
    expect(sourceWindow([2, 2, 3, 3], 100, 100)).toBeUndefined();
  });
});

describe('sampleTile', () => {
  const pixels = TILE_SIZE * TILE_SIZE;

  // A mapping that sends the tile's left half to the left half of a 4 x 2 window, and has no pixel
  // of the right half in the footprint
  const mapping = (): TileMapping => {
    const u = new Float64Array(pixels).fill(Number.NaN);
    const v = new Float64Array(pixels).fill(Number.NaN);
    const footprint = new Uint8Array(pixels);
    for (let row = 0; row < TILE_SIZE; row++) {
      for (let column = 0; column < TILE_SIZE / 2; column++) {
        const i = row * TILE_SIZE + column;
        u[i] = (column / (TILE_SIZE / 2)) * 0.5; // 0 to 0.5 of the extent
        v[i] = (row / TILE_SIZE) * 0.999;
        footprint[i] = 1;
      }
    }
    return {u, v, footprint};
  };

  test('takes the nearest source pixel, leaves the rest as the fill value, and keeps all samples', () => {
    // 4 x 2 image, 2 samples per pixel: pixel (col, row) holds [10 * row + col, 100]
    const raster = Uint16Array.from([0, 100, 1, 100, 2, 100, 3, 100, 10, 100, 11, 100, 12, 100, 13, 100]);
    const tile = sampleTile(
      mapping(),
      raster,
      {window: [0, 0, 4, 2], width: 4, height: 2},
      4,
      2,
      new Uint16Array(pixels * 2).fill(65535),
    );

    expect(tile).toBeInstanceOf(Uint16Array);
    expect(tile.length).toBe(pixels * 2);

    const at = (row: number, column: number) => [tile[(row * TILE_SIZE + column) * 2], tile[(row * TILE_SIZE + column) * 2 + 1]];
    expect(at(0, 0)).toEqual([0, 100]); // top left of the window
    expect(at(0, 127)).toEqual([1, 100]); // u just below 0.5 of the extent: second source column
    expect(at(255, 0)).toEqual([10, 100]); // bottom row
    expect(at(0, 200)).toEqual([65535, 65535]); // outside the footprint
  });

  test('reads from a decimated window', () => {
    // An 8 x 2 image whose first 4 columns were read at half size: 2 x 1 pixels. The mapping covers
    // u 0 to 0.5 of the extent, i.e. those 4 columns, so each half of it falls on one read pixel.
    const raster = Uint8Array.from([7, 9]);
    const tile = sampleTile(mapping(), raster, {window: [0, 0, 4, 2], width: 2, height: 1}, 8, 2, new Uint8Array(pixels));
    expect(tile[0]).toBe(7);
    expect(tile[127]).toBe(9);
    expect(tile[200]).toBe(0); // outside the footprint: the fill value, here 0
  });
});
