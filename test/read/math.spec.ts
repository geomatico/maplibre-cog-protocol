import {test, expect} from 'vitest';

import {
  tileIndexToMercatorBbox,
  tileIndexToPixelWindow,
  pixelWindowToTileCoverage,
  mercatorBboxToGeographicBbox,
  zoomFromResolution,
  tilePixelFromLatLonZoom
} from '../../src/read/math';

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

  test('tileIndexToPixelWindow maps the world tile to the full image extent', () => {
    const WORLD_EXTENT = 20037508.342789244;
    const fullWorld = [-WORLD_EXTENT, -WORLD_EXTENT, WORLD_EXTENT, WORLD_EXTENT];
    expect(tileIndexToPixelWindow({x: 0, y: 0, z: 0}, fullWorld, 256, 256)).toEqual([0, 0, 256, 256]);
  });

  test('tileIndexToPixelWindow maps the NE quadrant tile to its pixel window', () => {
    const WORLD_EXTENT = 20037508.342789244;
    const fullWorld = [-WORLD_EXTENT, -WORLD_EXTENT, WORLD_EXTENT, WORLD_EXTENT];
    // tile (1,0,1) covers the NE quadrant: pixel columns 128–256, rows 0–128
    expect(tileIndexToPixelWindow({x: 1, y: 0, z: 1}, fullWorld, 256, 256)).toEqual([128, 0, 256, 128]);
  });

  test('pixelWindowToTileCoverage covers the whole tile when the window is inside the image', () => {
    expect(pixelWindowToTileCoverage([0, 0, 256, 256], 256, 256, 256))
      .toEqual({left: 0, top: 0, right: 256, bottom: 256});

    // A window well inside a bigger image, resampled 4:1
    expect(pixelWindowToTileCoverage([512, 512, 1536, 1536], 2048, 2048, 256))
      .toEqual({left: 0, top: 0, right: 256, bottom: 256});
  });

  test('pixelWindowToTileCoverage leaves out the part of the window beyond the image', () => {
    // 1:1 window shifted 64 pixels up and to the left of the image origin
    expect(pixelWindowToTileCoverage([-64, -64, 192, 192], 1000, 1000, 256))
      .toEqual({left: 64, top: 64, right: 256, bottom: 256});

    // 1:1 window whose last 56 columns and rows fall past a 200x200 image
    expect(pixelWindowToTileCoverage([0, 0, 256, 256], 200, 200, 256))
      .toEqual({left: 0, top: 0, right: 200, bottom: 200});

    // Window entirely to the left of the image: no column is covered, so the rectangle is empty
    expect(pixelWindowToTileCoverage([-512, 0, 0, 512], 1000, 1000, 256))
      .toEqual({left: 0, top: 0, right: 0, bottom: 256});

    // Downsampled 2:1: every tile pixel takes 2 image pixels, so the border lands at half the index
    expect(pixelWindowToTileCoverage([-256, -256, 256, 256], 1000, 1000, 256))
      .toEqual({left: 128, top: 128, right: 256, bottom: 256});
  });

  test('pixelWindowToTileCoverage returns an empty rectangle when the window misses the image', () => {
    expect(pixelWindowToTileCoverage([-500, -500, -100, -100], 1000, 1000, 256))
      .toEqual({left: 0, top: 0, right: 0, bottom: 0});
    expect(pixelWindowToTileCoverage([1100, 1100, 1400, 1400], 1000, 1000, 256))
      .toEqual({left: 0, top: 0, right: 0, bottom: 0});
  });

  test('pixelWindowToTileCoverage accounts for the clamping of the last sampled pixel', () => {
    // Upsampling (a 36 px window blown up to 256): geotiff.js clamps the tail of the tile to the
    // last window pixel, so those tile pixels are covered iff that one is.
    expect(pixelWindowToTileCoverage([872, 872, 908, 908], 908, 908, 256))
      .toEqual({left: 0, top: 0, right: 256, bottom: 256}); // last window pixel (907) is the last image pixel
    expect(pixelWindowToTileCoverage([-65, -65, 0, 0], 576, 576, 256))
      .toEqual({left: 0, top: 0, right: 0, bottom: 0}); // last window pixel (-1) is still outside
  });

});
