import { expect, test } from '@jest/globals';

import { RendererMetadata, TileJSON } from '../../src/types';

import { TILE_SIZE } from '../../src/constants';
import { getMetadata } from '../../src/read/getMetadata';
import { getRawTile } from '../../src/read/getRawTile';
import { getTileJson } from '../../src/read/getTileJson';
import locationValues from '../../src/read/locationValues';
import { fakeRawTile } from './mocks/fakeRawTile.mock';

// Test data
const fakeTileJSON: TileJSON = {
  tilejson: '2.2.0',
  tiles: ['file.tif/{z}/{x}/{y}'],
  minzoom: 0,
  maxzoom: 23,
};

const fakeMetadata: RendererMetadata = {
  offset: 0,
  scale: 1,
  images: [],
  noData: 0,
  minzoom: 0,
  maxzoom: 23,
  zoomLevelMetadata: new Map(),
  x: 0,
  y: 0,
  z: 0,
  tileSize: TILE_SIZE,
};

// Mocks
jest.mock('@/read/getTileJson');
const mockedGetTileJson = jest.mocked(getTileJson);
mockedGetTileJson.mockReturnValue(Promise.resolve(fakeTileJSON));

jest.mock('@/read/getMetadata');
const mockedGetMetadata = jest.mocked(getMetadata);
mockedGetMetadata.mockReturnValue(Promise.resolve(fakeMetadata));

jest.mock('@/read/getRawTile');
const mockedGetRawTile = jest.mocked(getRawTile);
mockedGetRawTile.mockReturnValue(Promise.resolve(fakeRawTile));

describe('locationValues', () => {
  test('returns an array of numbers (one per band) with COG values for a given location', async () => {
    mockedGetRawTile.mockReturnValueOnce(
      Promise.resolve([new Uint8Array(65536).fill(1), new Uint8Array(65536).fill(2), new Uint8Array(65536).fill(3)])
    );

    const values = await locationValues('file.tif', { latitude: 0, longitude: 0 });
    expect(values).toEqual([1, 2, 3]);
  });

  test('applies scale and offset to values', async () => {
    mockedGetMetadata.mockReturnValueOnce(
      Promise.resolve({
        offset: 10,
        scale: 2,
        images: [],
        noData: 0,
        minzoom: 0,
        maxzoom: 23,
        zoomLevelMetadata: new Map(),
        x: 0,
        y: 0,
        z: 0,
      })
    );

    mockedGetRawTile.mockReturnValueOnce(
      Promise.resolve([new Uint8Array(65536).fill(1), new Uint8Array(65536).fill(2), new Uint8Array(65536).fill(3)])
    );

    const values = await locationValues('file.tif', { latitude: 0, longitude: 0 });
    expect(values).toEqual([12, 14, 16]);
  });

  test('returns NaN for noData values', async () => {
    mockedGetRawTile.mockReturnValueOnce(Promise.resolve([new Uint8Array(65536).fill(fakeMetadata.noData as number)]));

    const values = await locationValues('file.tif', { latitude: 0, longitude: 0 });
    expect(values).toEqual([NaN]);
  });

  test('returns NaN for values out of raster contents', async () => {
    mockedGetRawTile.mockReturnValueOnce(Promise.resolve([new Uint8Array(65536).fill(Infinity)]));

    const values = await locationValues('file.tif', { latitude: 0, longitude: 0 });
    expect(values).toEqual([NaN]);
  });
});
