import { expect, test } from '@jest/globals';

import getColorFunctionRenderer from '../../../src/render/custom/getColorFunctionRenderer';
import { RendererMetadata } from '../../../src/types';

describe('getColorFunctionRenderer', () => {
  test('returns a Renderer that assigns an RGBA color to each pixel based on the given colorFunction', () => {
    // GIVEN
    const pixelCount = 3 * 3;
    const givenTile: Uint8Array[] = [
      new Uint8Array(pixelCount).fill(0).map((_value, index) => index + 1),
      new Uint8Array(pixelCount).fill(0).map((_value, index) => (index + 1) * 10),
    ]; // Two bands
    const dummyMetadata: RendererMetadata = {
      images: [],
      offset: 0,
      scale: 1,
      minzoom: 0,
      maxzoom: 12,
      x: 0,
      y: 0,
      z: 0,
      zoomLevelMetadata: new Map(),
      tileSize: 3,
    };

    const expectedImage = new Uint8ClampedArray(pixelCount * 4);

    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
      expectedImage.set(
        [givenTile[0][pixelIndex], 2 * givenTile[0][pixelIndex], givenTile[1][pixelIndex], 2 * givenTile[1][pixelIndex]],
        pixelIndex * 4
      );
    }

    // WHEN
    const colorFunction = (pixel: Array<number>, color: Uint8ClampedArray) => {
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
