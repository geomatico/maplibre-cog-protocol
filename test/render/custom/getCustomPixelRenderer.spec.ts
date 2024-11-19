import {test, expect} from '@jest/globals';

import getCustomPixelRenderer from '../../../src/render/custom/getCustomPixelRenderer';

describe('getCustomPixelRenderer', () => {

  test('returns a Renderer that assigns an RGBA color to each pixel based on the given PixelToColor function', () => {
    // GIVEN
    const givenTile: Uint8Array[] = [new Uint8Array([1, 2, 3]), new Uint8Array([10, 20, 30])]; // Two bands, 3 pixels each
    const dummyMetadata = {images: [], offset: 0, scale: 1};
    const expectedImage = new Uint8ClampedArray([1, 2, 10, 20, 2, 4, 20, 40, 3, 6, 30, 60]); // Expects 3 RGBA values

    // WHEN
    const toColorFunction = (pixel: Array<number>, color: Uint8ClampedArray) => {
      color.set([pixel[0], 2 * pixel[0], pixel[1], 2 * pixel[1]]); // R = first band, G = 2 * first band, B = 2nd band, A = 2 * 2nd band
    };
    const renderer = getCustomPixelRenderer(toColorFunction);

    // THEN
    expect(renderer).toBeDefined();

    if (renderer) {
      const image = renderer(givenTile, dummyMetadata);
      expect(image).toEqual(expectedImage);
    }

  });
});
