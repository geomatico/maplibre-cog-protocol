import {test, expect} from '@jest/globals';

import {TypedArray} from '@/types';

import {fromUrl, GeoTIFF, GeoTIFFImage, Pool, ReadRasterResult} from 'geotiff';
import CogReader from '@/read/CogReader';
import {PhotometricInterpretations} from '@/render/renderPhoto';


// Test data

// @ts-expect-error only implementing used properties
const fakeFirstImage: GeoTIFFImage = {
  fileDirectory: {
    PhotometricInterpretation: PhotometricInterpretations.RGB,
    BitsPerSample: [8, 8, 8],
    Artist: 'Geomatico'
  },
  getBoundingBox: () => [201640.881, 5098655.535, 206532.850, 5102018.764],
  getGDALMetadata: () => ({
    OFFSET: '1.2',
    SCALE: '3.4'
  }),
  getGDALNoData: () => 1,
  getResolution: () => [0.29858214173896974]
};

// @ts-expect-error only implementing used properties
const fakeOverview: GeoTIFFImage = {
  getResolution: () => [0.5971642834779395],
  fileDirectory: {
    NewSubfileType: 1 // 1 = overview, 4 = mask, 5 = overview-mask
  }
};

// @ts-expect-error only implementing used properties
const fakeGeoTIFF: GeoTIFF = {
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

  test('CogReader opens a GeoTIFF and caches it based on its URL', () => {

    CogReader('file.tif').getMetadata();
    CogReader('file.tif').getMetadata();

    expect(mockedPool).toHaveBeenCalledTimes(1);
    expect(mockedFromUrl).toHaveBeenCalledTimes(1);
    expect(mockedFromUrl).toHaveBeenCalledWith('file.tif');
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
      minzoom: 18,
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
      interleave: false,
      resampleMethod: 'nearest',
      pool: {},
      fillValue: 1
    });
  });

});
