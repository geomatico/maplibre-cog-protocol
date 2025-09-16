import { expect, jest, test } from '@jest/globals';

import cogProtocol from '../src/cogProtocol';
import CogReader from '../src/read/CogReader';
import renderColor from '../src/render/renderColor';
import renderPhoto from '../src/render/renderPhoto';
import renderTerrain from '../src/render/renderTerrain';
import { CogMetadata, TileJSON, TypedArray } from '../src/types';
import RendererStore from '../src/render/custom/rendererStore';


// Test data
const fakeTileJSON: TileJSON = {
  tilejson: '2.2.0',
  tiles: ['cog://file.tif#hash/{z}/{x}/{y}'],
  minzoom: 0,
  maxzoom: 23
};

const fakeMetadata: CogMetadata = {
  offset: 0,
  scale: 1,
  images: []
};

const fakeRawTile: TypedArray = new Uint8Array(0);

const fakeImageTile: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(4 * 256 * 256);


// Mocks
jest.mock('@/read/CogReader');
const mockedCogReader = jest.mocked(CogReader);
mockedCogReader.mockReturnValue({
  getTilejson: () => Promise.resolve(fakeTileJSON),
  getMetadata: () => Promise.resolve(fakeMetadata),
  getRawTile: () => Promise.resolve(fakeRawTile)
});

jest.mock('@/render/custom/rendererStore');
const mockedRendererStore_get = jest.mocked(RendererStore.get);
mockedRendererStore_get.mockReturnValue(undefined);

jest.mock('@/render/renderColor');
const mockedRenderColor = jest.mocked(renderColor);
mockedRenderColor.mockReturnValue(fakeImageTile);

jest.mock('@/render/renderTerrain');
const mockedRenderPhoto = jest.mocked(renderPhoto);
mockedRenderPhoto.mockReturnValue(fakeImageTile);

jest.mock('@/render/renderPhoto');
const mockedRenderTerrain = jest.mocked(renderTerrain);
mockedRenderTerrain.mockReturnValue(fakeImageTile);


// Polyfills simulating a real browser

// @ts-expect-error This is a polyfill for jest environment
// eslint-disable-next-line no-global-assign
createImageBitmap <T> = (data: T): Promise<Uint8ClampedArray> => Promise.resolve(data);

// @ts-expect-error This is a polyfill for jest environment
// eslint-disable-next-line no-global-assign
ImageData = class {
  constructor(data: Uint8ClampedArray, width: number, height: number) {
    if (data.length !== 4 * width * height) {
      throw new Error(`Data length (${data.length}) is not 4 * width (${width}) * (${height})`);
    } else {
      return data;
    }
  }
};


describe('cogProtocol', () => {
  test('json type request returns a TileJSON with information about the data source', async () => {

    const response = await cogProtocol({
      type: 'json',
      url: 'cog://file.tif#hash'
    });

    expect(mockedCogReader).toHaveBeenCalledWith('file.tif');
    expect(response.data).toEqual(fakeTileJSON);
  });

  test('image request url should start with \'cog://\' and end with \'{z}/{x}/{y}\'', () => {

    expect(cogProtocol({
      type: 'image',
      url: 'maformed_url'
    })).rejects.toThrowError('Invalid COG protocol URL \'maformed_url\'');
  });


  test('image requests with a declared custom renderer should use it', async () => {

    mockedRendererStore_get.mockReturnValue(() => fakeImageTile);
    const response = await cogProtocol({
      type: 'image',
      url: 'cog://file.tif/1/2/3'
    });

    expect(mockedCogReader).toHaveBeenCalledWith('file.tif');
    expect(mockedRendererStore_get).toHaveBeenCalledWith('file.tif');

    const data: Uint8ClampedArray = response.data as unknown as Uint8ClampedArray;
    expect(isEqualArray(data, fakeImageTile)).toBe(true);
    mockedRendererStore_get.mockReturnValue(undefined);
  });


  test('image requests with no hash in url should return a Photo image', async () => {

    const response = await cogProtocol({
      type: 'image',
      url: 'cog://file.tif/1/2/3'
    });

    expect(mockedCogReader).toHaveBeenCalledWith('file.tif');
    expect(mockedRenderPhoto).toHaveBeenCalledWith(fakeRawTile, fakeMetadata);

    const data: Uint8ClampedArray = response.data as unknown as Uint8ClampedArray;
    expect(isEqualArray(data, fakeImageTile)).toBe(true);
  });


  test('image requests with #dem in url should return a TerrainRGB image', async () => {

    const response = await cogProtocol({
      type: 'image',
      url: 'cog://file.tif#dem/1/2/3'
    });

    expect(mockedCogReader).toHaveBeenCalledWith('file.tif');
    expect(mockedRenderTerrain).toHaveBeenCalledWith(fakeRawTile, fakeMetadata);

    const data: Uint8ClampedArray = response.data as unknown as Uint8ClampedArray;
    expect(isEqualArray(data, fakeImageTile)).toBe(true);
  });


  test('image requests with #color:{colorScheme},{min},{max},{modifiers} in url should parse its parameters and return an image', async () => {

    const response = await cogProtocol({
      type: 'image',
      url: 'cog://file.tif#color:scheme,10,20,-c/1/2/3'
    });

    const expectedColorScale = {
      colorScheme: 'scheme',
      customColors: [],
      min: 10,
      max: 20,
      isReverse: true,
      isContinuous: true
    }

    expect(mockedCogReader).toHaveBeenCalledWith('file.tif');
    expect(mockedRenderColor).toHaveBeenCalledWith(fakeRawTile, {...fakeMetadata, colorScale: expectedColorScale});

    const data: Uint8ClampedArray = response.data as unknown as Uint8ClampedArray;
    expect(isEqualArray(data, fakeImageTile)).toBe(true);
  });

  test('image requests with #color:{customColors},{min},{max},{modifiers} in url should parse its parameters and return an image', async () => {

    const response = await cogProtocol({
      type: 'image',
      url: 'cog://file.tif#color:["#f7fcb9", "#addd8e", "#31a354"],10,20,-c/1/2/3'
    });

    const expectedColorScale = {
      colorScheme: '',
      customColors: ['#f7fcb9', '#addd8e', '#31a354'],
      min: 10,
      max: 20,
      isReverse: true,
      isContinuous: true
    }

    expect(mockedCogReader).toHaveBeenCalledWith('file.tif');
    expect(mockedRenderColor).toHaveBeenCalledWith(fakeRawTile, {...fakeMetadata, colorScale: expectedColorScale});

    const data: Uint8ClampedArray = response.data as unknown as Uint8ClampedArray;
    expect(isEqualArray(data, fakeImageTile)).toBe(true);
  });


  test('image requests with #color and no params should throw an error', () => {

    expect(cogProtocol({
      type: 'image',
      url: 'cog://file.tif#color/1/2/3'
    })).rejects.toThrowError('Color params are not defined');

    expect(mockedCogReader).toHaveBeenCalledWith('file.tif');
    expect(mockedRenderColor).not.toHaveBeenCalled();
  });


  test('other request types should throw an error', () => {

    expect(cogProtocol({
      type: 'string',
      url: 'cog://file.tif'
    })).rejects.toThrowError('Unsupported request type \'string\'');
  });

});

afterEach(() => {
  mockedCogReader.mockClear();
  mockedRenderColor.mockClear();
  mockedRenderPhoto.mockClear();
  mockedRenderTerrain.mockClear();
});

const isEqualArray = (a: Uint8ClampedArray, b: Uint8ClampedArray): boolean => {
  if (a.length != b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] != b[i]) return false;
  }
  return true;
}
