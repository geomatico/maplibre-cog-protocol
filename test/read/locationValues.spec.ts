import {test, expect} from 'vitest';

import {CogMetadata, TileCoverage, TileJSON} from '../../src/types';

import locationValues from '../../src/read/locationValues';
import CogReader from '../../src/read/CogReader';
import {setMask, clearMask} from '../../src/render/mask';

// Test data
const fakeTileJSON: TileJSON = {
  tilejson: '2.2.0',
  tiles: ['file.tif/{z}/{x}/{y}'],
  minzoom: 0,
  maxzoom: 23
};

const fullCoverage: TileCoverage = {left: 0, top: 0, right: 256, bottom: 256};

const fakeMetadata: CogMetadata = {
  offset: 0,
  scale: 1,
  images: [],
  noData: 0
};

// Mocks
vi.mock('@/read/CogReader');
const mockedCogReader = vi.mocked(CogReader);

describe('locationValues', () => {

  test('returns an array of numbers (one per band) with COG values for a given location', async () => {
    const rawTile = new Uint8Array(65536 * 3);
    rawTile.set([1, 2, 3], 0);
    mockedCogReader.mockReturnValueOnce({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve(fakeMetadata),
      getRawTile: (_: unknown, options?: {mask?: boolean}) => Promise.resolve(options?.mask ? null : rawTile),
      getTileCoverage: () => Promise.resolve(fullCoverage)
    });

    const values = await locationValues('file.tif', {latitude: 0, longitude: 0});
    expect(values).toEqual([1, 2, 3]);
  });

  test('applies scale and offset to values', async () => {
    const rawTile = new Uint8Array(65536 * 3);
    rawTile.set([1, 2, 3], 0);
    mockedCogReader.mockReturnValueOnce({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve({
        offset: 10,
        scale: 2,
        images: [],
        noData: 0
      }),
      getRawTile: (_: unknown, options?: {mask?: boolean}) => Promise.resolve(options?.mask ? null : rawTile),
      getTileCoverage: () => Promise.resolve(fullCoverage)
    });

    const values = await locationValues('file.tif', {latitude: 0, longitude: 0});
    expect(values).toEqual([12, 14, 16]);
  });

   test('returns NaN for noData values', async () => {
    mockedCogReader.mockReturnValueOnce({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve(fakeMetadata),
      getRawTile: (_: unknown, options?: {mask?: boolean}) =>
        Promise.resolve(options?.mask ? null : new Uint8Array(65536).fill(0)),
      getTileCoverage: () => Promise.resolve(fullCoverage)
    });

    const values = await locationValues('file.tif', {latitude: 0, longitude: 0});
    expect(values).toEqual([NaN]);
  });

  test('noData is compared against the raw value, before scale and offset', async () => {
    const rawTile = new Uint8Array(65536);
    rawTile[0] = 99;
    mockedCogReader.mockReturnValueOnce({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve({offset: 10, scale: 2, images: [], noData: 99}),
      getRawTile: (_: unknown, options?: {mask?: boolean}) => Promise.resolve(options?.mask ? null : rawTile),
      getTileCoverage: () => Promise.resolve(fullCoverage)
    });

    const values = await locationValues('file.tif', {latitude: 0, longitude: 0});
    expect(values).toEqual([NaN]);
  });

  test('returns values when no noData is declared, including zeros', async () => {
    const rawTile = new Uint8Array(65536);
    mockedCogReader.mockReturnValueOnce({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve({offset: 0, scale: 1, images: []}),
      getRawTile: (_: unknown, options?: {mask?: boolean}) => Promise.resolve(options?.mask ? null : rawTile),
      getTileCoverage: () => Promise.resolve(fullCoverage)
    });

    const values = await locationValues('file.tif', {latitude: 0, longitude: 0});
    expect(values).toEqual([0]);
  });

  test('returns NaN where the COG mask band marks the pixel as invalid', async () => {
    const rawTile = new Uint8Array(65536).fill(42);
    const mask = new Uint8Array(65536).fill(255);
    mask[0] = 0; // null island at zoom 23 is the first pixel of its tile
    mockedCogReader.mockReturnValueOnce({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve({offset: 0, scale: 1, images: []}),
      getRawTile: (_: unknown, options?: {mask?: boolean}) => Promise.resolve(options?.mask ? mask : rawTile),
      getTileCoverage: () => Promise.resolve(fullCoverage)
    });

    const values = await locationValues('file.tif', {latitude: 0, longitude: 0});
    expect(values).toEqual([NaN]);
  });

  test('returns NaN where the alpha sample is zero', async () => {
    const rawTile = new Uint8Array(65536 * 4).fill(42);
    rawTile.set([10, 20, 30, 0], 0); // RGBA, fully transparent
    mockedCogReader.mockReturnValueOnce({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve({offset: 0, scale: 1, images: [], alphaBand: 3}),
      getRawTile: (_: unknown, options?: {mask?: boolean}) => Promise.resolve(options?.mask ? null : rawTile),
      getTileCoverage: () => Promise.resolve(fullCoverage)
    });

    const values = await locationValues('file.tif', {latitude: 0, longitude: 0});
    expect(values).toEqual([NaN, NaN, NaN, NaN]);
  });

  test('returns the values where the alpha sample is not zero', async () => {
    const rawTile = new Uint8Array(65536 * 4);
    rawTile.set([10, 20, 30, 255], 0);
    mockedCogReader.mockReturnValueOnce({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve({offset: 0, scale: 1, images: [], alphaBand: 3}),
      getRawTile: (_: unknown, options?: {mask?: boolean}) => Promise.resolve(options?.mask ? null : rawTile),
      getTileCoverage: () => Promise.resolve(fullCoverage)
    });

    const values = await locationValues('file.tif', {latitude: 0, longitude: 0});
    expect(values).toEqual([10, 20, 30, 255]);
  });

  test('returns NaN for a location outside the user mask, and values inside it', async () => {
    const rawTile = new Uint8Array(65536).fill(42);
    const reader = {
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve({offset: 0, scale: 1, images: []}),
      getRawTile: (_: unknown, options?: {mask?: boolean}) => Promise.resolve(options?.mask ? null : rawTile),
      getTileCoverage: () => Promise.resolve(fullCoverage)
    };
    mockedCogReader.mockReturnValue(reader);

    setMask({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: {type: 'Polygon', coordinates: [[[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]]}
      }]
    });

    expect(await locationValues('file.tif', {latitude: 1.5, longitude: 1.5})).toEqual([42]);
    expect(await locationValues('file.tif', {latitude: 10, longitude: 10})).toEqual([NaN]);

    clearMask();
    expect(await locationValues('file.tif', {latitude: 10, longitude: 10})).toEqual([42]);
  });

  test('returns NaN for values out of raster contents', async () => {
    // Null island at zoom 23 is the top-left pixel of its tile: a coverage starting one pixel to
    // the right and below leaves it outside the image.
    mockedCogReader.mockReturnValue({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve(fakeMetadata),
      getRawTile: (_: unknown, options?: {mask?: boolean}) =>
        Promise.resolve(options?.mask ? null : new Uint8Array(65536).fill(42)),
      getTileCoverage: () => Promise.resolve({left: 1, top: 1, right: 256, bottom: 256})
    });

    const values = await locationValues('file.tif', {latitude: 0, longitude: 0});
    expect(values).toEqual([NaN]);
  });
});
