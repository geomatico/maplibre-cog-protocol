import {describe, expect, test} from 'vitest';

import renderTerrain from '../../src/render/renderTerrain';

const PIXELS = 256 * 256;

// Terrain-RGB encoding: v = (h + 10000) / 0.1
// R = floor(v / 65536) % 256
// G = floor(v / 256) % 256
// B = v % 256

const makeFloat = (value: number): Float32Array => {
  const data = new Float32Array(PIXELS);
  data[0] = value;
  return data;
};

const px0 = (result: Uint8ClampedArray) => Array.from(result.slice(0, 4));

const baseOptions = {offset: 0, scale: 1, images: []};

describe('renderTerrain', () => {
  test('base elevation (-10000 m) encodes to (0,0,0)', () => {
    // v = (-10000 + 10000) / 0.1 = 0
    expect(px0(renderTerrain(makeFloat(-10000), baseOptions))).toEqual([0, 0, 0, 255]);
  });

  test('sea level (0 m) encodes correctly', () => {
    // v = 100000 → R=1, G=134, B=160
    expect(px0(renderTerrain(makeFloat(0), baseOptions))).toEqual([1, 134, 160, 255]);
  });

  test('noData pixel is encoded as elevation 0 (sea level)', () => {
    const data = new Float32Array(PIXELS);
    data[0] = 99;
    expect(px0(renderTerrain(data, {...baseOptions, noData: 99}))).toEqual([1, 134, 160, 255]);
  });

  test('Everest (~8848 m) encodes correctly', () => {
    // v = (8848 + 10000) / 0.1 = 188480 → R=2, G=224, B=64
    expect(px0(renderTerrain(makeFloat(8848), baseOptions))).toEqual([2, 224, 64, 255]);
  });

  test('alpha channel is always 255', () => {
    expect(renderTerrain(makeFloat(-10000), baseOptions)[3]).toBe(255);
    expect(renderTerrain(makeFloat(8848), baseOptions)[3]).toBe(255);
  });
});