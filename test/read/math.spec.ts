import {test, expect} from '@jest/globals';

import {tileIndexToMercatorBbox, mercatorBboxToGeographicBbox, zoomFromResolution} from '@/read/math';

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
});
