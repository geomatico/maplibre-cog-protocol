import {test, expect} from 'vitest';

import {applyAlpha} from '../../src/render/alpha';

const PIXELS = 256 * 256;

// An RGBA raster where only the first pixels are set, the rest being fully transparent black.
const makeRaster = (pixels: number[][], bands = 4) => {
  const raster = new Uint8Array(PIXELS * bands);
  pixels.forEach((pixel, i) => raster.set(pixel, i * bands));
  return raster;
};

const opaqueTile = () => new Uint8ClampedArray(4 * PIXELS).fill(255);

const px = (rgba: Uint8ClampedArray, i: number) => Array.from(rgba.slice(i * 4, i * 4 + 4));

describe('applyAlpha', () => {

  test('takes the alpha channel from the given band', () => {
    const rgba = opaqueTile();

    applyAlpha(rgba, makeRaster([[10, 20, 30, 255], [10, 20, 30, 0], [10, 20, 30, 128]]), {band: 3});

    expect(px(rgba, 0)[3]).toBe(255);
    expect(px(rgba, 1)[3]).toBe(0);
    expect(px(rgba, 2)[3]).toBe(128);
  });

  test('multiplies the alpha the renderer produced, instead of replacing it', () => {
    const rgba = opaqueTile();
    rgba[3] = 0; // already transparent, e.g. a noData pixel or a custom color function's choice

    applyAlpha(rgba, makeRaster([[10, 20, 30, 255]]), {band: 3});

    expect(px(rgba, 0)[3]).toBe(0);
  });

  test('scales a 16-bit alpha sample into 0..255', () => {
    const raster = new Uint16Array(PIXELS * 4);
    raster.set([1000, 2000, 3000, 65535], 0);
    raster.set([1000, 2000, 3000, 32767], 4); // just under half of 65535
    const rgba = opaqueTile();

    applyAlpha(rgba, raster, {band: 3, bitsPerSample: 16});

    expect(px(rgba, 0)[3]).toBe(255);
    expect(px(rgba, 1)[3]).toBe(127);
  });

  test('restores the colors of premultiplied (associated) alpha', () => {
    const rgba = opaqueTile();
    // Half-transparent red, stored premultiplied: (255,0,0) * 0.5 = (128,0,0)
    rgba.set([128, 0, 0, 255], 0);

    applyAlpha(rgba, makeRaster([[128, 0, 0, 128]]), {band: 3, premultiplied: true});

    const [r, g, b, a] = px(rgba, 0);
    expect(r).toBeGreaterThan(250);
    expect([g, b]).toEqual([0, 0]);
    expect(a).toBe(128);
  });

  test('leaves the colors alone for unassociated alpha', () => {
    const rgba = opaqueTile();
    rgba.set([128, 0, 0, 255], 0);

    applyAlpha(rgba, makeRaster([[128, 0, 0, 128]]), {band: 3});

    expect(px(rgba, 0)).toEqual([128, 0, 0, 128]);
  });

  test('does nothing when the alpha band was not read', () => {
    const rgba = opaqueTile();

    applyAlpha(rgba, makeRaster([[10, 20, 30]], 3), {band: 3});

    expect(px(rgba, 0)[3]).toBe(255);
  });

});
