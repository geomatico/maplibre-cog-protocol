import {test, expect} from '@jest/globals';

import RendererStore from '../../../src/render/custom/rendererStore';

const dummyMetadata = {images: [], offset: 0, scale: 1};
const sampleImage = new Uint8ClampedArray([0, 1, 2, 3]);

describe('rendererStore', () => {

  test('gets undefined when a renderer is not set', () => {
    RendererStore.set('stored.tif', () => sampleImage);
    const renderer = RendererStore.get('not_stored.tif');
    expect(renderer).toBeUndefined();
  });

  test('gets a custom renderer when it is set', () => {
    RendererStore.set('stored.tif', () => sampleImage);
    const renderer = RendererStore.get('stored.tif');
    expect(renderer).toBeInstanceOf(Function);
    if (renderer) {
      expect(renderer(new Int8Array(), dummyMetadata)).toEqual(sampleImage);
    }
  });
});
