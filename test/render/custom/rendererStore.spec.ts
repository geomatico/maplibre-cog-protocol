import { expect, test } from '@jest/globals';

import { TILE_SIZE } from '../../../src/constants';
import RendererStore from '../../../src/render/custom/rendererStore';
import { RendererMetadata } from '../../../src/types';

const dummyMetadata: RendererMetadata = {
  images: [],
  offset: 0,
  scale: 1,
  minzoom: 0,
  maxzoom: 23,
  zoomLevelMetadata: new Map(),
  x: 0,
  y: 0,
  z: 0,
  tileSize: TILE_SIZE,
};
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
      expect(renderer([], dummyMetadata)).toEqual(sampleImage);
    }
  });
});
