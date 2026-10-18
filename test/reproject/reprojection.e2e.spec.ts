import {resolve} from 'node:path';

import {afterAll, beforeAll, describe, expect, test} from 'vitest';

import {TILE_SIZE} from '../../src/constants';
import CogReader from '../../src/read/CogReader';
import locationValues from '../../src/read/locationValues';
import {tileIndexToMercatorBbox} from '../../src/read/math';
import {getProjection} from '../../src/reproject/projections';
import type {TileIndex} from '../../src/types';
import {serveFile} from './serveFile';

/**
 * End to end, on a real COG: test/data/irish-grid-xy.tif is in EPSG:29902 (Irish Grid), 1024 x 1024
 * pixels of 50 m with two overviews, and holds in its two bands the easting (minus 300,000) and
 * northing (minus 330,000), in metres, of each of its pixels. So for any tile pixel we know exactly
 * what the reprojection must have read: the Irish Grid coordinates of that pixel's centre.
 *
 * A pixel block of the COG is noData (65535) to check that is carried through too.
 */
const FILE = resolve(__dirname, '../data/irish-grid-xy.tif');
const EXTENT = [300000, 330000, 351200, 381200];
const NODATA = 65535;

let url: string;
let close: () => void;

beforeAll(async () => {
  ({url, close} = await serveFile(FILE));
});

afterAll(() => close());

const tileAt = (lon: number, lat: number, z: number): TileIndex => {
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / 180;
  return {
    z,
    x: Math.floor(((lon + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n),
  };
};

const irishGrid = getProjection(29902)!;

/** Irish Grid coordinates the tile pixel (row, column) is expected to hold. */
const expectedEastingNorthing = (tile: TileIndex, row: number, column: number): [number, number] => {
  const [west, south, east, north] = tileIndexToMercatorBbox(tile);
  const x = west + ((column + 0.5) * (east - west)) / TILE_SIZE;
  const y = north - ((row + 0.5) * (north - south)) / TILE_SIZE;
  return irishGrid.fromWebMercator(x, y);
};

const pointInside = ([e, n]: [number, number]) => e > EXTENT[0] && e < EXTENT[2] && n > EXTENT[1] && n < EXTENT[3];

describe('COG in EPSG:29902', () => {
  test('metadata reports the CRS, geographic bounds and a Web Mercator equivalent zoom', async () => {
    const metadata = await CogReader(url).getMetadata();

    expect(metadata.crs).toBe('EPSG:29902');
    expect(metadata.noData).toBe(NODATA);

    // Reference values computed with PROJ (pyproj) from the same definition, corners of the extent
    const [west, south, east, north] = metadata.bbox!;
    expect(west).toBeCloseTo(-6.4681, 3);
    expect(south).toBeCloseTo(54.1967, 3);
    expect(east).toBeCloseTo(-5.6579, 3);
    expect(north).toBeCloseTo(54.669, 3);

    // 50 m pixels at 54.4ºN are 50 / cos(54.4º) = 85.9 m of Web Mercator: zoom 10.83, where 50 m
    // pixels at the equator would be zoom 11.6. Each overview is one zoom lower.
    const zooms = metadata.images.map((image) => image.zoom);
    expect(zooms[0]).toBeCloseTo(10.832, 2);
    expect(zooms[0] - zooms[1]).toBeCloseTo(1, 2);
    expect(zooms[1] - zooms[2]).toBeCloseTo(1, 2);
  });

  test('tilejson has the geographic bounds and a maxzoom matching the full resolution image', async () => {
    const tilejson = await CogReader(url).getTilejson(`cog://${url}`);
    expect(tilejson.maxzoom).toBe(11); // round(10.83)
    expect(tilejson.bounds![0]).toBeCloseTo(-6.4681, 3);
  });

  // The image each zoom reads (image zooms are 10.83, 9.83 and 8.83): above 11 it is the full
  // resolution one, overzoomed; 10 reads the first overview and 9 and below the second.
  test.each([
    [17, 50],
    [14, 50],
    [11, 50],
    [10, 100],
    [9, 200],
    [8, 200],
  ])('tiles at zoom %i, read from %i m pixels, hold the Irish Grid coordinates of their pixels', async (z, sourcePixel) => {
    const cog = CogReader(url);
    const {lon, lat} = (() => {
      const [lon, lat] = irishGrid.toLonLat(321000, 352000); // inside the COG, clear of the noData hole
      return {lon, lat};
    })();
    const tile = tileAt(lon, lat, z);

    const raw = await cog.getRawTile(tile);
    const {footprint} = await cog.getTileCoverage(tile);
    expect(raw).toBeInstanceOf(Uint16Array);
    expect(raw.length).toBe(TILE_SIZE * TILE_SIZE * 2);
    expect(footprint).toBeDefined();

    // Nearest neighbour sampling is off by up to half a source pixel; the mesh adds up to 0.125 tile
    // pixels (a tile pixel is this many ground metres) to that.
    const [west, , east] = tileIndexToMercatorBbox(tile);
    const groundPerTilePixel = (((east - west) / TILE_SIZE) * Math.cos((lat * Math.PI) / 180));
    const tolerance = sourcePixel / 2 + 0.125 * groundPerTilePixel * 1.5 + 1;

    let checked = 0;
    for (let row = 0; row < TILE_SIZE; row += 3) {
      for (let column = 0; column < TILE_SIZE; column += 3) {
        const i = row * TILE_SIZE + column;
        const expected = expectedEastingNorthing(tile, row, column);
        if (!pointInside(expected) || footprint![i] === 0) continue;
        if (raw[i * 2] === NODATA) continue; // the noData hole

        expect(Math.abs(raw[i * 2] + 300000 - expected[0])).toBeLessThan(tolerance);
        expect(Math.abs(raw[i * 2 + 1] + 330000 - expected[1])).toBeLessThan(tolerance);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  test('a tile on the border of the COG is only partly covered, and the rest is fill', async () => {
    const cog = CogReader(url);
    const [lon, lat] = irishGrid.toLonLat(300000, 355000); // west edge of the COG
    const tile = tileAt(lon, lat, 13);

    const raw = await cog.getRawTile(tile);
    const {footprint, left, right, top, bottom} = await cog.getTileCoverage(tile);
    expect([left, top, right, bottom]).toEqual([0, 0, TILE_SIZE, TILE_SIZE]);

    const covered = footprint!.reduce((sum, value) => sum + value, 0);
    expect(covered).toBeGreaterThan(0);
    expect(covered).toBeLessThan(TILE_SIZE * TILE_SIZE);

    // Pixels outside the COG hold the fill value, which is the COG's noData value, as for COGs
    // that need no reprojection.
    for (let i = 0; i < footprint!.length; i++) {
      if (footprint![i] === 0) {
        expect(raw[i * 2]).toBe(NODATA);
        expect(raw[i * 2 + 1]).toBe(NODATA);
      }
    }
  });

  test('the footprint follows the real edge of the COG, which is not a rectangle of the tile', async () => {
    const cog = CogReader(url);
    const [lon, lat] = irishGrid.toLonLat(300000, 355000);
    const tile = tileAt(lon, lat, 13);
    const {footprint} = await cog.getTileCoverage(tile);

    // Compare with the exact test of whether each pixel centre is in the COG
    let disagreements = 0;
    for (let row = 0; row < TILE_SIZE; row++) {
      for (let column = 0; column < TILE_SIZE; column++) {
        const inside = pointInside(expectedEastingNorthing(tile, row, column));
        if (inside !== (footprint![row * TILE_SIZE + column] === 1)) disagreements++;
      }
    }
    // Only pixels astride the border can differ
    expect(disagreements).toBeLessThan(TILE_SIZE * 0.03);
  });

  test('a tile outside the COG is empty', async () => {
    const cog = CogReader(url);
    const tile = tileAt(-6.26, 53.35, 12); // Dublin, south of the COG
    expect(await cog.getTileCoverage(tile)).toEqual({left: 0, top: 0, right: 0, bottom: 0});
  });

  test('noData pixels are preserved', async () => {
    const cog = CogReader(url);
    // The hole is rows 400-480, columns 240-360 of the full resolution image
    const hole = irishGrid.toLonLat(300000 + 300 * 50, 381200 - 440 * 50);
    const tile = tileAt(hole[0], hole[1], 15);
    const raw = await cog.getRawTile(tile);
    expect(Array.from(raw).filter((value) => value === NODATA).length).toBeGreaterThan(100);
  });

  test('locationValues reads the value of the pixel under a location', async () => {
    const [longitude, latitude] = irishGrid.toLonLat(325025, 355025);
    const values = await locationValues(url, {latitude, longitude}, 16);
    expect(Math.abs(values[0] - 25025)).toBeLessThan(40);
    expect(Math.abs(values[1] - 25025)).toBeLessThan(40);

    const outside = await locationValues(url, {latitude: 53.35, longitude: -6.26}, 16);
    expect(outside.every(Number.isNaN)).toBe(true);
  });
});
