import {describe, expect, test} from 'vitest';

import {fromBlackIsZero, fromCIELab, fromCMYK, fromPalette, fromRGB, fromWhiteIsZero, fromYCbCr} from '../../src/render/rgba';

const PIXELS = 256 * 256;

const makeData = (bands: number, firstPixel: number[]): Uint8Array => {
  const data = new Uint8Array(PIXELS * bands);
  firstPixel.forEach((v, band) => {
    data[band] = v;
  });
  return data;
};

const px0 = (result: Uint8ClampedArray) => Array.from(result.slice(0, 4));

describe('fromWhiteIsZero', () => {
  test('max value maps to black, opaque', () => {
    expect(px0(fromWhiteIsZero(makeData(1, [255]), 255, 0))).toEqual([0, 0, 0, 255]);
  });

  test('zero maps to white and transparent when zero is the transparentValue', () => {
    expect(px0(fromWhiteIsZero(makeData(1, [0]), 255, 0))).toEqual([255, 255, 255, 0]);
  });

  test('zero maps to white and opaque when zero is not the transparentValue', () => {
    expect(px0(fromWhiteIsZero(makeData(1, [0]), 255, 99))).toEqual([255, 255, 255, 255]);
  });
});

describe('fromBlackIsZero', () => {
  test('max value maps to white, opaque', () => {
    expect(px0(fromBlackIsZero(makeData(1, [255]), 255, 0))).toEqual([255, 255, 255, 255]);
  });

  test('zero maps to black and transparent when zero is the transparentValue', () => {
    expect(px0(fromBlackIsZero(makeData(1, [0]), 255, 0))).toEqual([0, 0, 0, 0]);
  });

  test('mid-range value maps to the matching gray shade', () => {
    // (100/255)*255 = 100 exactly
    expect(px0(fromBlackIsZero(makeData(1, [100]), 255, 0))).toEqual([100, 100, 100, 255]);
  });
});

describe('fromRGB', () => {
  test('three-band pixel maps to RGBA, opaque', () => {
    expect(px0(fromRGB(makeData(3, [100, 150, 200]), 0))).toEqual([100, 150, 200, 255]);
  });

  test('pixel is transparent when all three channels equal the transparentValue', () => {
    expect(px0(fromRGB(makeData(3, [0, 0, 0]), 0))).toEqual([0, 0, 0, 0]);
  });

  test('pixel is opaque when only some channels match the transparentValue', () => {
    expect(px0(fromRGB(makeData(3, [100, 0, 0]), 0))).toEqual([100, 0, 0, 255]);
  });
});

describe('fromPalette', () => {
  // 2-entry palette. colorMap layout: [R0, R1, G0, G1, B0, B1] (16-bit values 0–65535).
  // Entry 0 → (0, 100, 200), entry 1 → (255, 0, 255).
  const colorMap = [0, 65280, 25600, 0, 51200, 65280];

  test('palette index 0 maps to the correct colour, opaque', () => {
    expect(px0(fromPalette(makeData(1, [0]), colorMap, 99))).toEqual([0, 100, 200, 255]);
  });

  test('pixel is transparent when the palette index equals the transparentValue', () => {
    expect(px0(fromPalette(makeData(1, [0]), colorMap, 0))[3]).toBe(0);
  });

  test('palette index 1 maps to the correct colour', () => {
    expect(px0(fromPalette(makeData(1, [1]), colorMap, 0))).toEqual([255, 0, 255, 255]);
  });
});

describe('fromCMYK', () => {
  test('pure cyan (C=255) produces zero red', () => {
    // R = 255 * ((255-255)/256) * ((255-0)/256) = 0
    // G = B = 255 * (255/256)^2 ≈ 253
    const result = px0(fromCMYK(makeData(4, [255, 0, 0, 0]), 99));
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(253);
    expect(result[2]).toBe(253);
    expect(result[3]).toBe(255);
  });

  test('pixel is transparent when all four channels equal the transparentValue', () => {
    expect(px0(fromCMYK(makeData(4, [0, 0, 0, 0]), 0))[3]).toBe(0);
  });

  test('pure black (K=255) maps to (0,0,0)', () => {
    // R = G = B = 255 * (255/256) * (0/256) = 0
    expect(px0(fromCMYK(makeData(4, [0, 0, 0, 255]), 99))).toEqual([0, 0, 0, 255]);
  });
});

describe('fromYCbCr', () => {
  test('neutral YCbCr (128,128,128) maps to neutral gray RGB', () => {
    // Y=128, Cb=128, Cr=128 — all chroma offsets (Cb-128, Cr-128) cancel out
    expect(px0(fromYCbCr(makeData(3, [128, 128, 128]), 0))).toEqual([128, 128, 128, 255]);
  });

  test('pixel is transparent when all three channels equal the transparentValue', () => {
    expect(px0(fromYCbCr(makeData(3, [0, 0, 0]), 0))[3]).toBe(0);
  });

  test('pixel is opaque when chroma channels differ from the transparentValue', () => {
    // (Y=0, Cb=128, Cr=128) ≠ (0,0,0), so not transparent
    expect(px0(fromYCbCr(makeData(3, [0, 128, 128]), 0))[3]).toBe(255);
  });
});

describe('fromCIELab', () => {
  test('L=100, a=0, b=0 (CIE Lab white) maps to (255,255,255)', () => {
    expect(px0(fromCIELab(makeData(3, [100, 0, 0]), 0))).toEqual([255, 255, 255, 255]);
  });

  test('pixel is transparent when all channels equal the transparentValue', () => {
    expect(px0(fromCIELab(makeData(3, [0, 0, 0]), 0))[3]).toBe(0);
  });
});