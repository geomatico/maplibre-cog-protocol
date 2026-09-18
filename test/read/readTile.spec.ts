import {test, expect, beforeEach} from 'vitest';

import {GeoTIFFImage, Pool} from 'geotiff';
import {readTileFast} from '../../src/read/readTile';

// A 4x4 image of 2 samples per pixel, stored in four 2x2 blocks. Each pixel holds
// [column, row], so any assembly mistake shows up as a wrong coordinate.
const makeBlock = (blockColumn: number, blockRow: number) => {
  const block = new Uint8Array(2 * 2 * 2);
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      block[(y * 2 + x) * 2] = blockColumn * 2 + x;
      block[(y * 2 + x) * 2 + 1] = blockRow * 2 + y;
    }
  }
  return block;
};

const fakeImage = (overrides: Record<string, unknown> = {}, tags: Record<string, unknown> = {}) => {
  const image = {
    planarConfiguration: 1,
    isTiled: true,
    littleEndian: true,
    fileDirectory: {
      loadValue: async (tag: string) => ({BitsPerSample: new Uint16Array([8, 8]), ...tags})[tag],
    },
    getSamplesPerPixel: () => 2,
    getWidth: () => 4,
    getHeight: () => 4,
    getTileWidth: () => 2,
    getTileHeight: () => 2,
    getBitsPerSample: () => 8,
    getSampleFormat: () => 1,
    getTileOrStrip: async (x: number, y: number) => ({x, y, sample: 0, data: makeBlock(x, y).buffer}),
    ...overrides,
  };
  // @ts-expect-error partial mock — the fields readTileFast touches are all here
  return image as GeoTIFFImage;
};

const bindParameters = vi.fn(() => ({}));
const fakePool = {bindParameters} as unknown as Pool;

const read = (image: GeoTIFFImage, window: [number, number, number, number], width = 4, height = 4, fillValue = 0) =>
  readTileFast(image, {window, width, height, fillValue, pool: fakePool});

// Reads back the [column, row] pair of one output pixel
const pixel = (raster: ArrayLike<number> | undefined, x: number, y: number, width = 4) =>
  raster && [raster[(y * width + x) * 2], raster[(y * width + x) * 2 + 1]];

describe('readTileFast', () => {

  beforeEach(() => bindParameters.mockClear());

  test('assembles a window that covers the whole image, across every block', async () => {
    const raster = await read(fakeImage(), [0, 0, 4, 4]);

    expect(pixel(raster, 0, 0)).toEqual([0, 0]);
    expect(pixel(raster, 3, 0)).toEqual([3, 0]); // last column of the second block
    expect(pixel(raster, 0, 3)).toEqual([0, 3]);
    expect(pixel(raster, 3, 3)).toEqual([3, 3]);
  });

  test('hands over a whole block as it is, when the tile maps onto one exactly', async () => {
    const raster = await read(fakeImage(), [2, 2, 4, 4], 2, 2); // the bottom-right block

    expect(pixel(raster, 0, 0, 2)).toEqual([2, 2]);
    expect(pixel(raster, 1, 1, 2)).toEqual([3, 3]);
  });

  test('assembles a window offset from the block grid', async () => {
    const raster = await read(fakeImage(), [1, 1, 3, 3], 2, 2);

    expect(pixel(raster, 0, 0, 2)).toEqual([1, 1]);
    expect(pixel(raster, 1, 1, 2)).toEqual([2, 2]);
  });

  test('samples nearest neighbour when the window is smaller than the output', async () => {
    const raster = await read(fakeImage(), [0, 0, 2, 2], 4, 4); // 2x2 window blown up to 4x4

    expect(pixel(raster, 0, 0)).toEqual([0, 0]);
    expect(pixel(raster, 1, 1)).toEqual([1, 1]); // round(1 * 0.5) = 1
    expect(pixel(raster, 3, 3)).toEqual([1, 1]); // clamped to the last window pixel
  });

  test('leaves the fill value where the window falls outside the image', async () => {
    const raster = await read(fakeImage(), [-2, -2, 2, 2], 4, 4, 9);

    expect(pixel(raster, 0, 0)).toEqual([9, 9]); // before the image
    expect(pixel(raster, 1, 1)).toEqual([9, 9]);
    expect(pixel(raster, 2, 2)).toEqual([0, 0]); // first real pixel
    expect(pixel(raster, 3, 3)).toEqual([1, 1]);
  });

  test('returns a fully filled raster when the window misses the image entirely', async () => {
    const raster = await read(fakeImage(), [-10, -10, -6, -6], 4, 4, 9);

    expect(raster).toHaveLength(4 * 4 * 2);
    expect(Array.from(raster ?? []).every((value) => value === 9)).toBe(true);
  });

  test('hands back band interleaved images', async () => {
    expect(await read(fakeImage({planarConfiguration: 2}), [0, 0, 4, 4])).toBeUndefined();
  });

  test('reads JPEG, passing on the tables its decoder needs', async () => {
    const tables = new Uint8Array([1, 2]);
    const jpeg = fakeImage({}, {Compression: 7, JPEGTables: tables, BitsPerSample: new Uint16Array([8, 8])});

    expect(await read(jpeg, [0, 0, 4, 4])).toBeDefined();
    expect(bindParameters).toHaveBeenCalledWith(7, expect.objectContaining({JPEGTables: tables}));
  });

  test('reads LERC, passing on the header parameters its decoder needs', async () => {
    const lercParameters = new Uint32Array([4, 0]);
    const lerc = fakeImage({}, {Compression: 34887, LercParameters: lercParameters, BitsPerSample: new Uint16Array([8, 8])});

    expect(await read(lerc, [0, 0, 4, 4])).toBeDefined();
    expect(bindParameters).toHaveBeenCalledWith(34887, expect.objectContaining({LercParameters: lercParameters}));
  });

  test('reads WebP, passing on the sample count its decoder needs', async () => {
    const webp = fakeImage({}, {Compression: 50001, BitsPerSample: new Uint16Array([8, 8])});

    expect(await read(webp, [0, 0, 4, 4])).toBeDefined();
    expect(bindParameters).toHaveBeenCalledWith(50001, expect.objectContaining({samplesPerPixel: 2}));
  });

  test('hands back compressions whose decoder needs parameters this shortcut does not derive', async () => {
    // Old-style JPEG (6): geotiff.js explicitly refuses to decode it at all.
    const oldJpeg = fakeImage({}, {Compression: 6, BitsPerSample: new Uint16Array([8, 8])});
    expect(await read(oldJpeg, [0, 0, 4, 4])).toBeUndefined();
  });

  test('hands back a predictor on a striped image, where the block geometry is not exact', async () => {
    const striped = fakeImage({isTiled: false}, {Predictor: 2, BitsPerSample: new Uint16Array([8, 8])});
    expect(await read(striped, [0, 0, 4, 4])).toBeUndefined();

    const tiled = fakeImage({}, {Predictor: 2, BitsPerSample: new Uint16Array([8, 8])});
    expect(await read(tiled, [0, 0, 4, 4])).toBeDefined();
  });

  test('hands back samples it cannot lay out in a typed array', async () => {
    expect(await read(fakeImage({getBitsPerSample: () => 12}), [0, 0, 4, 4])).toBeUndefined();
    expect(await read(fakeImage({getSampleFormat: () => 3, getBitsPerSample: () => 16}), [0, 0, 4, 4])).toBeUndefined();

    const mixed = fakeImage({getBitsPerSample: (sample: number) => (sample === 0 ? 8 : 16)});
    expect(await read(mixed, [0, 0, 4, 4])).toBeUndefined();
  });

  test('hands back big endian images with more than one byte per sample', async () => {
    const bigEndian = fakeImage({littleEndian: false, getBitsPerSample: () => 16, getSampleFormat: () => 1});
    expect(await read(bigEndian, [0, 0, 4, 4])).toBeUndefined();
  });

  test('hands back when a decoded block is not the size the layout implies', async () => {
    const short = fakeImage({getTileOrStrip: async () => ({x: 0, y: 0, sample: 0, data: new Uint8Array(3).buffer})});
    expect(await read(short, [0, 0, 4, 4])).toBeUndefined();
  });

});
