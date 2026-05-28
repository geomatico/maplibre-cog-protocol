import {describe, expect, test} from 'vitest';

import renderColor from '../../src/render/renderColor';

const PIXELS = 256 * 256;

const baseOptions = {
  offset: 0,
  scale: 1,
  images: [],
  colorScale: {colorScheme: 'BrewerYlGn3', customColors: [], min: 0, max: 10},
};

describe('renderColor', () => {
  test('valid pixel is opaque and receives a colour from the scale', () => {
    const data = new Uint8Array(PIXELS);
    data[0] = 5;
    const result = renderColor(data, baseOptions);
    expect(result[3]).toBe(255);
    expect(result[0] + result[1] + result[2]).toBeGreaterThan(0);
  });

  test('noData pixel is transparent', () => {
    const data = new Uint8Array(PIXELS);
    data[0] = 99;
    expect(renderColor(data, {...baseOptions, noData: 99})[3]).toBe(0);
  });

  test('NaN pixel is transparent', () => {
    const data = new Float32Array(PIXELS);
    data[0] = Number.NaN;
    expect(renderColor(data, baseOptions)[3]).toBe(0);
  });

  test('Infinity pixel is transparent', () => {
    const data = new Float32Array(PIXELS);
    data[0] = Infinity;
    expect(renderColor(data, baseOptions)[3]).toBe(0);
  });

  test('only the first band contributes to the colour for multi-band data', () => {
    const single = new Uint8Array(PIXELS);
    single[0] = 5;

    const multi = new Uint8Array(PIXELS * 2);
    multi[0] = 5;   // band 0: same value as single-band case
    multi[1] = 200; // band 1: should be ignored

    const r1 = renderColor(single, baseOptions);
    const r2 = renderColor(multi, baseOptions);
    expect(Array.from(r1.slice(0, 4))).toEqual(Array.from(r2.slice(0, 4)));
  });
});