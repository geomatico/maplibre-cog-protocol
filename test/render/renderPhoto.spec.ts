import {describe, expect, test} from 'vitest';

import renderPhoto, {PhotometricInterpretations} from '../../src/render/renderPhoto';

const PIXELS = 256 * 256;

const makeData = (bands: number, firstPixel: number[]): Uint8Array => {
  const data = new Uint8Array(PIXELS * bands);
  firstPixel.forEach((v, band) => {
    data[band] = v;
  });
  return data;
};

const px0 = (result: Uint8ClampedArray) => Array.from(result.slice(0, 4));

const baseMetadata = {offset: 0, scale: 1, images: [], bitsPerSample: [8]};

describe('renderPhoto', () => {
  test('WhiteIsZero: max input value maps to near-black, opaque', () => {
    const result = renderPhoto(makeData(1, [255]), {
      ...baseMetadata,
      photometricInterpretation: PhotometricInterpretations.WhiteIsZero,
    });
    expect(result[3]).toBe(255);
    expect(result[0]).toBeLessThan(5);
  });

  test('BlackIsZero: max input value maps to near-white, opaque', () => {
    const result = renderPhoto(makeData(1, [255]), {
      ...baseMetadata,
      photometricInterpretation: PhotometricInterpretations.BlackIsZero,
    });
    expect(result[0]).toBeGreaterThan(250);
    expect(result[3]).toBe(255);
  });

  test('RGB: three-band pixel maps to RGBA', () => {
    expect(
      px0(
        renderPhoto(makeData(3, [100, 150, 200]), {
          ...baseMetadata,
          photometricInterpretation: PhotometricInterpretations.RGB,
        }),
      ),
    ).toEqual([100, 150, 200, 255]);
  });

  test('Palette: index 0 maps through the colorMap', () => {
    // entry 0 → (0, 100, 200) using 16-bit values divisible by 256
    // noData=99 so that palette index 0 is not treated as transparent
    const colorMap = [0, 0, 25600, 0, 51200, 0];
    expect(
      px0(
        renderPhoto(makeData(1, [0]), {
          ...baseMetadata,
          noData: 99,
          photometricInterpretation: PhotometricInterpretations.Palette,
          colorMap,
        }),
      ),
    ).toEqual([0, 100, 200, 255]);
  });

  test('Palette: throws when colorMap is absent', () => {
    expect(() =>
      renderPhoto(makeData(1, [0]), {
        ...baseMetadata,
        photometricInterpretation: PhotometricInterpretations.Palette,
      }),
    ).toThrow('colorMap for paletted image not found');
  });

  test('CMYK: returns a Uint8ClampedArray', () => {
    expect(
      renderPhoto(makeData(4, [255, 0, 0, 0]), {
        ...baseMetadata,
        photometricInterpretation: PhotometricInterpretations.CMYK,
      }),
    ).toBeInstanceOf(Uint8ClampedArray);
  });

  test('YCbCr: neutral (128,128,128) maps to gray', () => {
    expect(
      px0(
        renderPhoto(makeData(3, [128, 128, 128]), {
          ...baseMetadata,
          photometricInterpretation: PhotometricInterpretations.YCbCr,
        }),
      ),
    ).toEqual([128, 128, 128, 255]);
  });

  test('CIELab: L=100, a=0, b=0 maps to white', () => {
    const result = renderPhoto(makeData(3, [100, 0, 0]), {
      ...baseMetadata,
      photometricInterpretation: PhotometricInterpretations.CIELab,
    });
    expect(result[0]).toBe(255);
    expect(result[1]).toBe(255);
    expect(result[2]).toBe(255);
  });

  test('throws for an unsupported photometric interpretation', () => {
    expect(() =>
      renderPhoto(makeData(1, [0]), {
        ...baseMetadata,
        photometricInterpretation: 99,
      }),
    ).toThrow('Unsupported photometric interpretation');
  });
});