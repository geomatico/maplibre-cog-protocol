import {test, expect} from '@jest/globals';

import CustomRendererStore from '../../../src/render/custom/rendererStore';
import setColorFunction from '../../../src/render/custom/setColorFunction';
import getColorFunctionRenderer from '../../../src/render/custom/getColorFunctionRenderer';

// Mocks
jest.mock('@/render/custom/getColorFunctionRenderer');
const mockedGetCustomPixelRenderer = jest.mocked(getColorFunctionRenderer);
const fakeRenderer = () => new Uint8ClampedArray([]);
mockedGetCustomPixelRenderer.mockReturnValue(fakeRenderer);

describe('setColorFunction', () => {

  test('adds a custom renderer to the store based on the given colorFunction', () => {
    // GIVEN
    const colorFunction = () => {};

    // WHEN
    setColorFunction('sample.tif', colorFunction);

    // THEN
    const renderer = CustomRendererStore.get('sample.tif');
    expect(mockedGetCustomPixelRenderer).toHaveBeenCalledWith(colorFunction);
    expect(renderer).toEqual(fakeRenderer);

  });
});
