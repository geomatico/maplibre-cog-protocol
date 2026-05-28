import {test, expect} from '@jest/globals';

import {TypedArray} from '../../src/types';

import {fromUrl, GeoTIFF, Pool, ReadRasterResult} from 'geotiff';
import CogReader, {setRequestHeaders} from '../../src/read/CogReader';
import {PhotometricInterpretations} from '../../src/render/renderPhoto';


// Test data

const fakeFirstImage = {
  fileDirectory: {
    loadValue: jest.fn(async (tag: string | number) => {
      if (tag === "Artist") return 'Geomatico';
      if (tag === "BitsPerSample") return [8, 8, 8];
      if (tag === "PhotometricInterpretation") return PhotometricInterpretations.RGB;
      if (tag === "NewSubfileType") return 0;
      return undefined;
    }),
  },
  getGeoKeys: () => ({ProjectedCSTypeGeoKey: 3857}),
  getBoundingBox: () => [201640.881, 5098655.535, 206532.850, 5102018.764],
  getGDALMetadata: async () => ({OFFSET: '1.2', SCALE: '3.4'}),
  getGDALNoData: () => 1,
  getResolution: () => [0.29858214173896974],
};

const fakeOverview = {
  getResolution: () => [0.5971642834779395],
  fileDirectory: {
    loadValue: jest.fn(async (tag: string | number) => {
      if (tag === "NewSubfileType") return 1; // 1 = overview, 4 = mask, 5 = overview-mask
      return undefined;
    }),
  },
};

const fakeGeoTIFF: GeoTIFF = {
  // @ts-expect-error partial mock — fakeFirstImage/fakeOverview don't implement GeoTIFFImage fully
  getImage: (index?: number) => Promise.resolve(index === 1 ? fakeOverview : fakeFirstImage),
  getImageCount: () => Promise.resolve(2), // A base image and an overview
  readRasters: jest.fn(() => Promise.resolve(fakeReadRasterResult)),
};

const fakeRawTile: TypedArray[] = [
  new Uint8Array(65536),
  new Uint8Array(65536),
  new Uint8Array(65536)
];

const fakeReadRasterResult: ReadRasterResult = fakeRawTile as ReadRasterResult;


// Mocks
jest.mock('geotiff');
const mockedFromUrl = jest.mocked(fromUrl);
mockedFromUrl.mockReturnValue(Promise.resolve(fakeGeoTIFF));

const fakePool = {} as Pool;

const mockedPool = jest.mocked(Pool);
mockedPool.mockReturnValue(fakePool);


describe('CogReader', () => {

  beforeEach(() => {
    mockedPool.mockClear();
    mockedFromUrl.mockClear();
    fakeFirstImage.fileDirectory.loadValue.mockClear();
    fakeOverview.fileDirectory.loadValue.mockClear();
  });

  test('CogReader opens a GeoTIFF and caches it based on its URL', () => {

    CogReader('file.tif').getMetadata();
    CogReader('file.tif').getMetadata();

    expect(mockedPool).toHaveBeenCalledTimes(1);
    expect(mockedFromUrl).toHaveBeenCalledTimes(1);
    expect(mockedFromUrl).toHaveBeenCalledWith('file.tif', undefined);
  });


  test('setRequestHeaders sets request headers when reading a GeoTIFF', () => {
    const customHeaders = {'Authorization': 'Bearer XXXX'};

    setRequestHeaders(customHeaders);
    CogReader('file2.tif').getMetadata();

    expect(mockedFromUrl).toHaveBeenCalledTimes(1);
    expect(mockedFromUrl).toHaveBeenCalledWith('file2.tif', {headers: customHeaders});
  });

  test('getMetadata returns useful GeoTIFF metadata', async () => {

    const response = await CogReader('file.tif').getMetadata();

    expect(response).toEqual({
      photometricInterpretation: 2,
      noData: 1,
      offset: 1.2,
      scale: 3.4,
      bitsPerSample: [8, 8, 8],
      artist: 'Geomatico',
      bbox: [
        1.811370853056256,
        41.58257960321504,
        1.8553161582776452,
        41.60517452144075
      ],
      images: [{
        zoom: 19,
        isOverview: false,
        isMask: false
      }, {
        zoom: 18,
        isOverview: true,
        isMask: false
      }]
    });

    expect(CogReader)

  });

  test('getMetadata throws for non-Mercator projections', async () => {
    mockedFromUrl.mockReturnValueOnce(Promise.resolve({
      ...fakeGeoTIFF,
      getImage: () => Promise.resolve({...fakeFirstImage, getGeoKeys: () => ({ProjectedCSTypeGeoKey: 32636})}),
    } as any));

    await expect(CogReader('utm.tif').getMetadata())
      .rejects.toThrow('EPSG:32636 in utm.tif is not supported');
  });

  test('getTilejson returns a standard TileJSON document describing GeoTIFF as a data source', async () => {

    const response = await CogReader('file.tif').getTilejson('cog://file.tif#dem');

    expect(response).toEqual({
      tilejson: '2.2.0',
      tiles: [
        'cog://file.tif#dem/{z}/{x}/{y}'
      ],
      bounds: [
        1.811370853056256,
        41.58257960321504,
        1.8553161582776452,
        41.60517452144075
      ],
      minzoom: 0,
      maxzoom: 19,
      attribution: 'Geomatico'
    });
  });


  test('getRawTile reads tile contents', async () => {
    const response = await CogReader('file.tif').getRawTile({z: 15, x: 16550, y: 12213});

    expect(response).toEqual(fakeRawTile);
    expect(fakeGeoTIFF.readRasters).toHaveBeenCalledWith({
      bbox: [
        203016.7471254281,
        5099878.527186957,
        204239.73957799093,
        5101101.51963952
      ],
      width: 256,
      height: 256,
      interleave: true,
      resampleMethod: 'nearest',
      pool: fakePool,
      fillValue: 1
    });
  });

});
