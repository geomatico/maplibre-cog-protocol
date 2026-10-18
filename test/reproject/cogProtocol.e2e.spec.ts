import {resolve} from 'node:path';

import {afterAll, beforeAll, describe, expect, test, vi} from 'vitest';

import cogProtocol from '../../src/cogProtocol';
import {TILE_SIZE} from '../../src/constants';
import {tileIndexToMercatorBbox} from '../../src/read/math';
import setColorFunction from '../../src/render/custom/setColorFunction';
import {getProjection} from '../../src/reproject/projections';
import type {TileJSON} from '../../src/types';
import {serveFile} from './serveFile';

/** Rendered end to end through the protocol, as MapLibre would request it. */

class FakeImageData {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number,
  ) {}
}
vi.stubGlobal('ImageData', FakeImageData);
vi.stubGlobal('createImageBitmap', (image: FakeImageData) => Promise.resolve(image));

const EXTENT = [300000, 330000, 351200, 381200];

let url: string;
let close: () => void;

beforeAll(async () => {
  ({url, close} = await serveFile(resolve(__dirname, '../data/irish-grid-xy.tif')));
});
afterAll(() => close());

describe('cogProtocol with a COG in EPSG:29902', () => {
  test('serves a TileJSON in geographic coordinates', async () => {
    const {data} = (await cogProtocol({url: `cog://${url}`, type: 'json'})) as {data: TileJSON};

    expect(data.bounds![0]).toBeCloseTo(-6.4681, 3);
    expect(data.bounds![3]).toBeCloseTo(54.669, 3);
    expect(data.maxzoom).toBe(11);
    expect(data.tiles).toEqual([`cog://${url}/{z}/{x}/{y}`]);
  });

  test('renders a tile whose transparent area is the real, slanted outline of the COG', async () => {
    // Opaque whatever the pixel holds, so that any transparency comes from the COG's footprint, not
    // from noData. Red and green show the easting and northing the pixel holds.
    setColorFunction(url, (pixel, color) => color.set([pixel[0] >> 8, pixel[1] >> 8, 0, 255]));

    // A tile on the west border: the COG is on its right, and a grid-north-aligned border shows
    // slightly slanted in Web Mercator because of the grid convergence
    const irishGrid = getProjection(29902)!;
    const [lon, lat] = irishGrid.toLonLat(300000, 355000);
    const z = 13;
    const n = 2 ** z;
    const latRad = (lat * Math.PI) / 180;
    const tile = {
      z,
      x: Math.floor(((lon + 180) / 360) * n),
      y: Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n),
    };

    const {data} = (await cogProtocol({url: `cog://${url}/${z}/${tile.x}/${tile.y}`, type: 'image'})) as {
      data: FakeImageData;
    };
    expect(data.width).toBe(TILE_SIZE);
    expect(data.height).toBe(TILE_SIZE);

    const [west, south, east, north] = tileIndexToMercatorBbox(tile);
    let disagreements = 0;
    let opaque = 0;
    for (let row = 0; row < TILE_SIZE; row++) {
      for (let column = 0; column < TILE_SIZE; column++) {
        const x = west + ((column + 0.5) * (east - west)) / TILE_SIZE;
        const y = north - ((row + 0.5) * (north - south)) / TILE_SIZE;
        const [e, nn] = irishGrid.fromWebMercator(x, y);
        const inside = e > EXTENT[0] && e < EXTENT[2] && nn > EXTENT[1] && nn < EXTENT[3];

        const alpha = data.data[(row * TILE_SIZE + column) * 4 + 3];
        if (inside !== (alpha === 255)) disagreements++;
        if (alpha === 255) opaque++;
      }
    }

    expect(opaque).toBeGreaterThan(1000);
    expect(opaque).toBeLessThan(TILE_SIZE * TILE_SIZE);
    expect(disagreements).toBeLessThan(TILE_SIZE * 0.03); // pixels astride the border only

    // And the opaque pixels carry the coordinates: red grows towards the east, green to the north
    const rgba = (row: number, column: number) => Array.from(data.data.slice((row * TILE_SIZE + column) * 4, (row * TILE_SIZE + column) * 4 + 4));
    const [r1, g1] = rgba(128, 200);
    const [r2] = rgba(128, 250);
    const [, g2] = rgba(20, 200);
    expect(r2).toBeGreaterThanOrEqual(r1); // further east
    expect(g2).toBeGreaterThanOrEqual(g1); // further north
  });
});
