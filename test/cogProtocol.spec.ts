import { expect, vi, test } from 'vitest';

import cogProtocol from '../src/cogProtocol';
import CogReader from '../src/read/CogReader';
import renderColor from '../src/render/renderColor';
import renderPhoto from '../src/render/renderPhoto';
import renderTerrain from '../src/render/renderTerrain';
import { CogMetadata, TileJSON, TypedArray } from '../src/types';
import RendererStore from '../src/render/custom/rendererStore';
import {ColorScaleParams} from '../src/render/colorScale';


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
vi.mock('@/read/CogReader');
const mockedCogReader = vi.mocked(CogReader);
mockedCogReader.mockReturnValue({
  getTilejson: () => Promise.resolve(fakeTileJSON),
  getMetadata: () => Promise.resolve(fakeMetadata),
  getRawTile: (_: unknown, options?: {mask?: boolean}) => Promise.resolve(options?.mask ? null : fakeRawTile),
  getTileCoverage: () => Promise.resolve({left: 0, top: 0, right: 256, bottom: 256}),
});

vi.mock('@/render/custom/rendererStore');
const mockedRendererStore_get = vi.mocked(RendererStore.get);
mockedRendererStore_get.mockReturnValue(undefined);

vi.mock('@/render/renderColor');
const mockedRenderColor = vi.mocked(renderColor);
mockedRenderColor.mockReturnValue(fakeImageTile);

vi.mock('@/render/renderTerrain');
const mockedRenderPhoto = vi.mocked(renderPhoto);
mockedRenderPhoto.mockReturnValue(fakeImageTile);

vi.mock('@/render/renderPhoto');
const mockedRenderTerrain = vi.mocked(renderTerrain);
mockedRenderTerrain.mockReturnValue(fakeImageTile);


// Polyfills simulating a real browser
vi.stubGlobal('createImageBitmap', (data: unknown) => Promise.resolve(data));
vi.stubGlobal('ImageData', class {
  constructor(data: Uint8ClampedArray, width: number, height: number) {
    if (data.length !== 4 * width * height) {
      throw new Error(`Data length (${data.length}) is not 4 * width (${width}) * (${height})`);
    } else {
      return data;
    }
  }
});


describe('cogProtocol', () => {
  test('json type request returns a TileJSON with information about the data source', async () => {

    const response = await cogProtocol({
      type: 'json',
      url: 'cog://file.tif#hash'
    });

    expect(mockedCogReader).toHaveBeenCalledWith('file.tif');
    expect(response.data).toEqual(fakeTileJSON);
  });

  test('image request url should start with \'cog://\' and end with \'{z}/{x}/{y}\'', async () => {

    await expect(cogProtocol({
      type: 'image',
      url: 'maformed_url'
    })).rejects.toThrow('Invalid COG protocol URL \'maformed_url\'');
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

    const expectedColorScale: ColorScaleParams = {
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


  test('image requests with #color and no params should throw an error', async () => {

    await expect(cogProtocol({
      type: 'image',
      url: 'cog://file.tif#color/1/2/3'
    })).rejects.toThrow('Color params are not defined');

    expect(mockedCogReader).toHaveBeenCalledWith('file.tif');
    expect(mockedRenderColor).not.toHaveBeenCalled();
  });


  test('other request types should throw an error', async () => {

    await expect(cogProtocol({
      type: 'string',
      url: 'cog://file.tif'
    })).rejects.toThrow('Unsupported request type \'string\'');
  });

  test('raw COG mask zeros the alpha channel of pixels where the mask value is 0', async () => {
    const rgba = new Uint8ClampedArray(4 * 256 * 256).fill(255); // all pixels fully opaque
    mockedRenderPhoto.mockReturnValueOnce(rgba);

    const mask = new Uint8Array(256 * 256).fill(255); // all opaque by default
    mask[5] = 0;   // pixel 5 is masked → alpha should become 0
    mask[100] = 0; // pixel 100 is masked → alpha should become 0

    mockedCogReader.mockReturnValueOnce({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve(fakeMetadata),
      getRawTile: (_: unknown, options?: {mask?: boolean}) => Promise.resolve(options?.mask ? mask : fakeRawTile),
      getTileCoverage: () => Promise.resolve({left: 0, top: 0, right: 256, bottom: 256}),
    });

    await cogProtocol({type: 'image', url: 'cog://file.tif/1/2/3'});

    expect(rgba[5 * 4 + 3]).toBe(0);    // masked pixel → transparent
    expect(rgba[100 * 4 + 3]).toBe(0);  // masked pixel → transparent
    expect(rgba[0 * 4 + 3]).toBe(255);  // unmasked pixel → still opaque
    expect(rgba[200 * 4 + 3]).toBe(255); // unmasked pixel → still opaque
  });

  test('the COG mask band takes precedence over its noData value', async () => {
    const mask = new Uint8Array(256 * 256).fill(255);

    mockedCogReader.mockReturnValueOnce({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve({...fakeMetadata, noData: 0}),
      getRawTile: (_: unknown, options?: {mask?: boolean}) => Promise.resolve(options?.mask ? mask : fakeRawTile),
      getTileCoverage: () => Promise.resolve({left: 0, top: 0, right: 256, bottom: 256}),
    });

    await cogProtocol({type: 'image', url: 'cog://file.tif/1/2/3'});

    // GDAL ignores noData when the file states validity in a mask band (RFC 15)
    expect(mockedRenderPhoto).toHaveBeenCalledWith(fakeRawTile, expect.objectContaining({noData: undefined}));
  });

  test('the noData value reaches the renderer when the COG has no mask band', async () => {
    mockedCogReader.mockReturnValueOnce({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve({...fakeMetadata, noData: 0}),
      getRawTile: (_: unknown, options?: {mask?: boolean}) => Promise.resolve(options?.mask ? null : fakeRawTile),
      getTileCoverage: () => Promise.resolve({left: 0, top: 0, right: 256, bottom: 256}),
    });

    await cogProtocol({type: 'image', url: 'cog://file.tif/1/2/3'});

    expect(mockedRenderPhoto).toHaveBeenCalledWith(fakeRawTile, expect.objectContaining({noData: 0}));
  });

  test('the alpha sample of the COG is applied to the rendered tile', async () => {
    const rgba = new Uint8ClampedArray(4 * 256 * 256).fill(255);
    mockedRenderPhoto.mockReturnValueOnce(rgba);

    const rawTile = new Uint8Array(256 * 256 * 4).fill(255);
    rawTile[3] = 0;     // first pixel: fully transparent
    rawTile[7] = 128;   // second pixel: half transparent

    mockedCogReader.mockReturnValueOnce({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve({...fakeMetadata, alphaBand: 3, bitsPerSample: [8, 8, 8, 8]}),
      getRawTile: (_: unknown, options?: {mask?: boolean}) => Promise.resolve(options?.mask ? null : rawTile),
      getTileCoverage: () => Promise.resolve({left: 0, top: 0, right: 256, bottom: 256}),
    });

    await cogProtocol({type: 'image', url: 'cog://file.tif/1/2/3'});

    expect(rgba[3]).toBe(0);
    expect(rgba[7]).toBe(128);
    expect(rgba[11]).toBe(255);
  });

  test('the alpha sample is ignored when the COG declares a noData value, as in GDAL', async () => {
    const rgba = new Uint8ClampedArray(4 * 256 * 256).fill(255);
    mockedRenderPhoto.mockReturnValueOnce(rgba);

    const rawTile = new Uint8Array(256 * 256 * 4).fill(255);
    rawTile[3] = 0;

    mockedCogReader.mockReturnValueOnce({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve({...fakeMetadata, noData: 0, alphaBand: 3, bitsPerSample: [8, 8, 8, 8]}),
      getRawTile: (_: unknown, options?: {mask?: boolean}) => Promise.resolve(options?.mask ? null : rawTile),
      getTileCoverage: () => Promise.resolve({left: 0, top: 0, right: 256, bottom: 256}),
    });

    await cogProtocol({type: 'image', url: 'cog://file.tif/1/2/3'});

    expect(rgba[3]).toBe(255); // renderPhoto decides, through noData
  });

  test('the alpha sample is not applied to terrain tiles', async () => {
    const rgba = new Uint8ClampedArray(4 * 256 * 256).fill(255);
    mockedRenderTerrain.mockReturnValueOnce(rgba);

    const rawTile = new Uint8Array(256 * 256 * 2).fill(255);
    rawTile[1] = 0;

    mockedCogReader.mockReturnValueOnce({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve({...fakeMetadata, alphaBand: 1, bitsPerSample: [8, 8]}),
      getRawTile: (_: unknown, options?: {mask?: boolean}) => Promise.resolve(options?.mask ? null : rawTile),
      getTileCoverage: () => Promise.resolve({left: 0, top: 0, right: 256, bottom: 256}),
    });

    await cogProtocol({type: 'image', url: 'cog://file.tif#dem/1/2/3'});

    expect(rgba[3]).toBe(255);
  });

  test('pixels outside the COG coverage are transparent', async () => {
    const rgba = new Uint8ClampedArray(4 * 256 * 256).fill(255); // all pixels fully opaque
    mockedRenderPhoto.mockReturnValueOnce(rgba);

    mockedCogReader.mockReturnValueOnce({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve(fakeMetadata),
      getRawTile: (_: unknown, options?: {mask?: boolean}) => Promise.resolve(options?.mask ? null : fakeRawTile),
      // The COG only covers the bottom-right quarter of the tile.
      getTileCoverage: () => Promise.resolve({left: 128, top: 128, right: 256, bottom: 256}),
    });

    await cogProtocol({type: 'image', url: 'cog://file.tif/1/2/3'});

    const alpha = (column: number, row: number) => rgba[(row * 256 + column) * 4 + 3];
    expect(alpha(0, 0)).toBe(0);       // outside, above and to the left
    expect(alpha(200, 100)).toBe(0);   // outside, above
    expect(alpha(100, 200)).toBe(0);   // outside, to the left
    expect(alpha(128, 128)).toBe(255); // first covered pixel
    expect(alpha(255, 255)).toBe(255); // last covered pixel
  });

  test('coverage is not applied to terrain tiles, whose alpha channel is not transparency', async () => {
    const rgba = new Uint8ClampedArray(4 * 256 * 256).fill(255);
    mockedRenderTerrain.mockReturnValueOnce(rgba);

    mockedCogReader.mockReturnValueOnce({
      getTilejson: () => Promise.resolve(fakeTileJSON),
      getMetadata: () => Promise.resolve(fakeMetadata),
      getRawTile: (_: unknown, options?: {mask?: boolean}) => Promise.resolve(options?.mask ? null : fakeRawTile),
      getTileCoverage: () => Promise.resolve({left: 128, top: 128, right: 256, bottom: 256}),
    });

    await cogProtocol({type: 'image', url: 'cog://file.tif#dem/1/2/3'});

    expect(mockedRenderTerrain).toHaveBeenCalled();
    expect(rgba[3]).toBe(255); // uncovered pixel, still opaque: renderTerrain encodes it as 0 m
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
