import {test, expect} from '@jest/globals';

import getColorFunctionRenderer from '../../../src/render/custom/getColorFunctionRenderer';
import { TypedArray } from '../../../src/types';

describe('getColorFunctionRenderer', () => {

  test('returns a Renderer that assigns an RGBA color to each pixel based on the given colorFunction', () => {
    // GIVEN
    const givenTile: Uint8Array = new Uint8Array(256 * 256 * 2).fill(0);
    givenTile.set([1, 10, 2, 20, 3, 30]); // Two bands, 3 pixels, interleaved
    const dummyMetadata = {images: [], offset: 0, scale: 1};
    const expectedImage = new Uint8ClampedArray(256 * 256 * 4).fill(0);
    expectedImage.set([1, 2, 10, 20, 2, 4, 20, 40, 3, 6, 30, 60], 0); // Expects 3 RGBA values

    // WHEN
    const colorFunction = (pixel: TypedArray, color: Uint8ClampedArray) => {
      color.set([pixel[0], 2 * pixel[0], pixel[1], 2 * pixel[1]]); // R = first band, G = 2 * first band, B = 2nd band, A = 2 * 2nd band
    };
    const renderer = getColorFunctionRenderer(colorFunction);

    // THEN
    expect(renderer).toBeDefined();

    if (renderer) {
      const image = renderer(givenTile, dummyMetadata);
      expect(image).toEqual(expectedImage);
    }

  });
});
