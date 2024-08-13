import {test, expect} from '@jest/globals';

import {
  tileIndexToMercatorBbox,
  mercatorBboxToGeographicBbox,
  zoomFromResolution,
  tilePixelFromLatLonZoom
} from '@/read/math';

describe('math', () => {
  test('calculates the BBOX of a tile in EPSG:3857 coordinates', () => {
    const expected = [0, 0, 20037508.342789244, 20037508.342789244];
    tileIndexToMercatorBbox({x: 1, y: 0, z: 1})
      .every((v: number, i: number) =>
        expect(v).toBeCloseTo(expected[i])
      );
  });

  test('converts a BBOX in EPSG:3857 to a BBOX in EPSG:4326', () => {
    const expected = [0, 0, 180, 85.0511287798066];
    mercatorBboxToGeographicBbox([0, 0, 20037508.342789244, 20037508.342789244])
      .every((v: number, i: number) =>
        expect(v).toBeCloseTo(expected[i])
      );
  });

  test('calculates zoom level based on pixel resolution', () => {
    const input = [
      0.29858214173896974,
      0.5971642834779395,
      1.194328566955879,
      2.388657133911758,
      4.777314267823516,
      9.554628535647032,
      19.109257071294063
    ];
    const expected = [19, 18, 17, 16, 15, 14, 13];
    expect(input.map(zoomFromResolution)).toEqual(expected);
  });

  test('calculates the tile index and internal pixel row/column for a given location and zoom level', () => {
    const cases = [
      // Null island at zoom 0 is in the center of the (single) tile
      {latitude: 0, longitude: 0, zoom: 0, x: 0, y: 0, column: 128, row: 128},

      // Null island at zoom 1 is in the corner of the north-western tile
      {latitude: 0, longitude: 0, zoom: 1, x: 1, y: 1, column: 0, row: 0},

      // Null island at zoom 18 is in the corner of the tile index x = y = 2**18 / 2
      {latitude: 0, longitude: 0, zoom: 18, x: 131072, y: 131072, column: 0, row: 0},

      // Barcelona coordinates at zoom 1 are somewhere in that north-western tile
      {latitude: 41.3874, longitude: 2.1686, zoom: 1, x: 1, y: 0, column: 3, row: 191},

      // Barcelona coordinates at zoom 18 are at some tile in the expected range
      {latitude: 41.3874, longitude: 2.1686, zoom: 18, x: 132651, y: 97909, column: 32, row: 184},
    ];

    cases.map(({latitude, longitude, zoom, x, y, row, column}) =>
      expect(
        tilePixelFromLatLonZoom({latitude, longitude, zoom})
      ).toEqual({
        tileIndex: {z: zoom, x, y},
        row,
        column
      })
    );
  });

});
