import {test, expect} from '@jest/globals';

import CustomRendererStore from '../../../src/render/custom/rendererStore';
import setCustomColor from '../../../src/render/custom/setCustomColor';
import getCustomPixelRenderer from '../../../src/render/custom/getCustomPixelRenderer';

// Mocks
jest.mock('@/render/custom/getCustomPixelRenderer');
const mockedGetCustomPixelRenderer = jest.mocked(getCustomPixelRenderer);
const fakeRenderer = () => new Uint8ClampedArray([]);
mockedGetCustomPixelRenderer.mockReturnValue(fakeRenderer);

describe('setCustomColor', () => {

  test('adds a customPixelRenderer in the store based on the given function', () => {
    // GIVEN
    const toColorFunction = () => {};

    // WHEN
    setCustomColor('sample.tif', toColorFunction);

    // THEN
    const renderer = CustomRendererStore.get('sample.tif');
    expect(mockedGetCustomPixelRenderer).toHaveBeenCalledWith(toColorFunction);
    expect(renderer).toEqual(fakeRenderer);

  });
});
