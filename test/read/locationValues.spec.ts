import {test, expect} from '@jest/globals';

import {CogMetadata, TileJSON} from '@/types';

import locationValues from '@/read/locationValues';
import CogReader from '@/read/CogReader';

// Test data
const fakeTileJSON: TileJSON = {
  tilejson: '2.2.0',
  tiles: ['file.tif/{z}/{x}/{y}'],
  minzoom: 0,
  maxzoom: 23
};

const fakeMetadata: CogMetadata = {
  offset: 0,
  scale: 1,
  images: [],
  noData: 0
};

// Mocks
jest.mock('@/read/CogReader');
const mockedCogReader = jest.mocked(CogReader);

describe('locationValues', () => {

  test('returns an array of numbers (one per band) with COG values for a given location', async () => {
    mockedCogReader.mockReturnValueOnce({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve(fakeMetadata),
      getRawTile: () => Promise.resolve([
        new Uint8Array(65536).fill(1),
        new Uint8Array(65536).fill(2),
        new Uint8Array(65536).fill(3),
      ])
    });

    const values = await locationValues('file.tif', {latitude: 0, longitude: 0});
    expect(values).toEqual([1, 2, 3]);
  });

  test('returns NaN for noData values', async () => {
    mockedCogReader.mockReturnValueOnce({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve(fakeMetadata),
      getRawTile: () => Promise.resolve([
        new Uint8Array(65536).fill(fakeMetadata.noData)
      ])
    });

    const values = await locationValues('file.tif', {latitude: 0, longitude: 0});
    expect(values).toEqual([NaN]);
  });

  test('returns NaN for values out of raster contents', async () => {
    mockedCogReader.mockReturnValue({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve(fakeMetadata),
      getRawTile: () => Promise.resolve([
        new Uint8Array(65536).fill(Infinity)
      ])
    });

    const values = await locationValues('file.tif', {latitude: 0, longitude: 0});
    expect(values).toEqual([NaN]);
  });
});
