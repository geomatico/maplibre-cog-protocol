import {test, expect, beforeEach, describe, beforeAll} from 'vitest';
import {FeatureCollection, MultiPolygon, Polygon} from 'geojson';

// --- OffscreenCanvas + Path2D mock ------------------------------------------------
// OffscreenCanvas is a browser API unavailable in Jest/Node. The mock below
// implements only the operations applyMask uses, with fill() backed by the same
// ray-casting logic so pixel-level assertions work without a real GPU context.

const raycastInsideRing = (px: number, py: number, ring: [number, number][]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
};

class MockPath2D {
  rings: [number, number][][] = [];
  private _current: [number, number][] = [];
  moveTo(x: number, y: number) {
    if (this._current.length) this.rings.push(this._current);
    this._current = [[x, y]];
  }
  lineTo(x: number, y: number) { this._current.push([x, y]); }
  closePath() {
    if (this._current.length) { this.rings.push([...this._current]); this._current = []; }
  }
}

class MockContext2D {
  private _buf: Uint8ClampedArray;
  private _sx = 1; private _sy = 1; private _tx = 0; private _ty = 0;
  globalCompositeOperation = 'source-over';
  fillStyle = 'black';
  constructor(private w: number, private h: number) {
    this._buf = new Uint8ClampedArray(w * h * 4);
  }
  createImageData(w: number, h: number) {
    return {data: new Uint8ClampedArray(w * h * 4), width: w, height: h};
  }
  putImageData(id: {data: Uint8ClampedArray}) { this._buf.set(id.data); }
  getImageData(x: number, y: number, w: number, h: number) {
    return {data: this._buf.slice(), width: w, height: h};
  }
  setTransform(sx: number, _b: number, _c: number, sy: number, tx: number, ty: number) {
    this._sx = sx; this._sy = sy; this._tx = tx; this._ty = ty;
  }
  fill(path: MockPath2D) {
    if (this.globalCompositeOperation !== 'destination-in') return;
    // Apply stored transform to ring coordinates once before pixel loop.
    const txRings = path.rings.map(ring =>
      ring.map(([x, y]): [number, number] => [x * this._sx + this._tx, y * this._sy + this._ty])
    );
    for (let row = 0; row < this.h; row++) {
      for (let col = 0; col < this.w; col++) {
        let crossings = 0;
        for (const ring of txRings) {
          if (raycastInsideRing(col + 0.5, row + 0.5, ring)) crossings++;
        }
        if (crossings % 2 === 0) this._buf[(row * this.w + col) * 4 + 3] = 0;
      }
    }
  }
}

class MockOffscreenCanvas {
  constructor(public width: number, public height: number) {}
  getContext() { return new MockContext2D(this.width, this.height); }
}

beforeAll(() => {
  (global as any).OffscreenCanvas = MockOffscreenCanvas;
  (global as any).Path2D = MockPath2D;
});

// --- Tests -----------------------------------------------------------------------

import {applyMask, clearMask, setMask, toTilePixel} from '../../src/render/mask';

// z=0: single 256×256 tile covering the whole world.
// Equator (lat=0) → row 128 exactly. Prime meridian (lng=0) → col 128 exactly.
const WORLD_TILE = {x: 0, y: 0, z: 0};

const solidTile = () => new Uint8ClampedArray(256 * 256 * 4).fill(255);
const alpha = (rgba: Uint8ClampedArray, row: number, col: number) =>
  rgba[(row * 256 + col) * 4 + 3];

beforeEach(() => clearMask());

describe('toTilePixel', () => {
  test('prime meridian / equator maps to centre of world tile', () => {
    const [col, row] = toTilePixel([0, 0], WORLD_TILE);
    expect(col).toBeCloseTo(128, 0);
    expect(row).toBeCloseTo(128, 0);
  });

  test('top-left corner of world tile', () => {
    const [col, row] = toTilePixel([-180, 85.05], WORLD_TILE);
    expect(col).toBeCloseTo(0, 0);
    expect(row).toBeCloseTo(0, 0);
  });
});

describe('applyMask', () => {
  test('is a no-op when no mask is set', () => {
    const rgba = solidTile();
    applyMask(rgba, WORLD_TILE);
    expect(alpha(rgba, 128, 128)).toBe(255);
  });

  test('preserves pixels inside the mask, makes pixels outside transparent', () => {
    const northernHemisphere: FeatureCollection<Polygon> = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[-180, 0], [180, 0], [180, 85.05], [-180, 85.05], [-180, 0]]]
        },
        properties: {}
      }]
    };

    setMask(northernHemisphere);
    const rgba = solidTile();
    applyMask(rgba, WORLD_TILE);

    expect(alpha(rgba, 50, 128)).toBe(255);  // northern hemisphere: preserved
    expect(alpha(rgba, 200, 128)).toBe(0);   // southern hemisphere: transparent
  });

  test('hole in polygon makes interior pixels transparent', () => {
    const worldWithHole: FeatureCollection<Polygon> = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [[-180, -85.05], [180, -85.05], [180, 85.05], [-180, 85.05], [-180, -85.05]],
            [[-180, -10],    [180, -10],    [180, 10],    [-180, 10],    [-180, -10]],
          ]
        },
        properties: {}
      }]
    };

    setMask(worldWithHole);
    const rgba = solidTile();
    applyMask(rgba, WORLD_TILE);

    expect(alpha(rgba, 50, 128)).toBe(255);  // above equator, outside hole: preserved
    expect(alpha(rgba, 128, 128)).toBe(0);   // equator, inside hole: transparent
    expect(alpha(rgba, 200, 128)).toBe(255); // below equator, outside hole: preserved
  });

  test('MultiPolygon masks to union of all polygons', () => {
    const twoHemispheres: FeatureCollection<MultiPolygon> = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [[[-180, -85.05], [0, -85.05], [0, 85.05], [-180, 85.05], [-180, -85.05]]],
            [[[0, -85.05], [180, -85.05], [180, 85.05], [0, 85.05], [0, -85.05]]],
          ]
        },
        properties: {}
      }]
    };

    setMask(twoHemispheres);
    const rgba = solidTile();
    applyMask(rgba, WORLD_TILE);

    expect(alpha(rgba, 128, 50)).toBe(255);  // western hemisphere: preserved
    expect(alpha(rgba, 128, 200)).toBe(255); // eastern hemisphere: preserved
  });

  test('non-polygon geometry types are ignored', () => {
    const withPoint = {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        geometry: {type: 'Point' as const, coordinates: [0, 0]},
        properties: {}
      }]
    };

    setMask(withPoint as any);
    const rgba = solidTile();
    applyMask(rgba, WORLD_TILE);

    expect(alpha(rgba, 0, 0)).toBe(0);       // no polygon coverage → all transparent
    expect(alpha(rgba, 128, 128)).toBe(0);
  });

  test('clearMask removes the mask', () => {
    const farAway: FeatureCollection<Polygon> = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[150, 0], [160, 0], [160, 10], [150, 10], [150, 0]]]
        },
        properties: {}
      }]
    };

    setMask(farAway);
    clearMask();
    const rgba = solidTile();
    applyMask(rgba, WORLD_TILE);

    expect(alpha(rgba, 128, 128)).toBe(255);
  });
});