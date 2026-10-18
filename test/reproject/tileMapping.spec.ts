import {describe, expect, test} from 'vitest';

import {TILE_SIZE} from '../../src/constants';
import {tileIndexToMercatorBbox} from '../../src/read/math';
import {detectReprojection} from '../../src/reproject/georeference';
import {getProjection} from '../../src/reproject/projections';
import {buildTileMapping} from '../../src/reproject/tileMapping';

// The extent of test/data/irish-grid-xy.tif, 51.2 km around Belfast, in EPSG:29902
const EXTENT: [number, number, number, number] = [300000, 330000, 351200, 381200];
const reprojection = detectReprojection('test.tif', {ProjectedCSTypeGeoKey: 29902}, EXTENT, false)!;

// Slippy-map tile index of a longitude/latitude
const tileAt = (lon: number, lat: number, z: number) => {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return {z, x, y};
};

describe('buildTileMapping', () => {
  const [lon, lat] = getProjection(29902)!.toLonLat(325600, 355600);

  test.each([8, 11, 14, 17])('agrees with exact per-pixel projection at zoom %i', (z) => {
    const tile = tileAt(lon, lat, z);
    const mapping = buildTileMapping(tile, reprojection);
    const projection = reprojection.projection;

    const [west, south, east, north] = tileIndexToMercatorBbox(tile);
    let compared = 0;
    let worst = 0;
    for (let row = 0; row < TILE_SIZE; row += 5) {
      for (let column = 0; column < TILE_SIZE; column += 5) {
        const mx = west + ((column + 0.5) * (east - west)) / TILE_SIZE;
        const my = north - ((row + 0.5) * (north - south)) / TILE_SIZE;
        const [sx, sy] = projection.fromWebMercator(mx, my);
        const exactU = (sx - EXTENT[0]) / (EXTENT[2] - EXTENT[0]);
        const exactV = (EXTENT[3] - sy) / (EXTENT[3] - EXTENT[1]);

        const i = row * TILE_SIZE + column;
        const inside = exactU >= 0 && exactU < 1 && exactV >= 0 && exactV < 1;
        if (inside !== (mapping.footprint[i] === 1)) continue; // only a pixel on the border may differ

        if (inside) {
          // error in pixels of the full resolution image (1024 x 1024)
          worst = Math.max(worst, Math.abs(mapping.u[i] - exactU) * 1024, Math.abs(mapping.v[i] - exactV) * 1024);
          compared++;
        }
      }
    }
    expect(compared).toBeGreaterThan(100);

    // The mesh promises 0.125 *tile* pixels. Express that in pixels of the source image: one tile
    // pixel is (Web Mercator resolution x cos(latitude)) ground metres, one source pixel is 50 m.
    const sourcePixelsPerTilePixel = (((east - west) / TILE_SIZE) * Math.cos((lat * Math.PI) / 180)) / 50;
    expect(worst).toBeLessThan(0.125 * 1.5 * sourcePixelsPerTilePixel + 0.01);
  });

  test('a tile outside the COG has an empty footprint and no bounds', () => {
    const mapping = buildTileMapping(tileAt(2.35, 48.85, 10), reprojection); // Paris
    expect(mapping.bounds).toBeUndefined();
    expect(mapping.footprint.every((value) => value === 0)).toBe(true);
  });

  test('a tile straddling the COG border is partly covered', () => {
    // West edge of the COG, at its middle
    const [edgeLon, edgeLat] = getProjection(29902)!.toLonLat(
      300000,
      355600,
    );
    const mapping = buildTileMapping(tileAt(edgeLon, edgeLat, 13), reprojection);
    const covered = mapping.footprint.reduce((sum, value) => sum + value, 0);
    expect(covered).toBeGreaterThan(0);
    expect(covered).toBeLessThan(TILE_SIZE * TILE_SIZE);
  });
});
