import {test, expect} from 'vitest';

import {TypedArray} from '../../src/types';

import {fromUrl, GeoTIFF, Pool, ReadRasterResult} from 'geotiff';
import CogReader, {setRequestHeaders} from '../../src/read/CogReader';
import {PhotometricInterpretations} from '../../src/render/renderPhoto';


// Test data

const fakeFirstImage = {
  fileDirectory: {
    loadValue: vi.fn(async (tag: string | number) => {
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

const fakeRawTile: TypedArray[] = [
  new Uint8Array(65536),
  new Uint8Array(65536),
  new Uint8Array(65536)
];

const fakeReadRasterResult: ReadRasterResult = fakeRawTile as ReadRasterResult;

const fakeOverviewReadRasters = vi.fn(() => Promise.resolve(fakeReadRasterResult));

const fakeOverview = {
  getResolution: () => [0.5971642834779395],
  getWidth: () => 8192,
  getHeight: () => 5632,
  readRasters: fakeOverviewReadRasters,
  fileDirectory: {
    loadValue: vi.fn(async (tag: string | number) => {
      if (tag === "NewSubfileType") return 1; // 1 = overview, 4 = mask, 5 = overview-mask
      return undefined;
    }),
  },
};

const fakeGeoTIFF: GeoTIFF = {
  // @ts-expect-error partial mock — fakeFirstImage/fakeOverview don't implement GeoTIFFImage fully
  getImage: (index?: number) => Promise.resolve(index === 1 ? fakeOverview : fakeFirstImage),
  getImageCount: () => Promise.resolve(2), // A base image and an overview
  readRasters: vi.fn(() => Promise.resolve(fakeReadRasterResult)),
};

const fakeMaskReadRasters = vi.fn(() => Promise.resolve(new Uint8Array(65536).fill(255)));

const fakeMaskImage = {
  fileDirectory: {
    loadValue: vi.fn(async (tag: string | number) => {
      if (tag === 'NewSubfileType') return 4; // isMask
      return undefined;
    }),
  },
  getResolution: () => [0.29858214173896974], // zoom 19
  getWidth: () => 256,
  getHeight: () => 256,
  readRasters: fakeMaskReadRasters,
};

// A GeoTIFF with 3 images: base (0), overview (1), mask (2).
const fakeGeoTIFFWithMask = {
  // @ts-expect-error partial mock
  getImage: (index?: number) => {
    if (index === 2) return Promise.resolve(fakeMaskImage);
    if (index === 1) return Promise.resolve(fakeOverview);
    return Promise.resolve(fakeFirstImage);
  },
  getImageCount: () => Promise.resolve(3),
  readRasters: vi.fn(() => Promise.resolve(fakeReadRasterResult)),
};


// Mocks
vi.mock('geotiff');
const mockedFromUrl = vi.mocked(fromUrl);
mockedFromUrl.mockReturnValue(Promise.resolve(fakeGeoTIFF));

const fakePool = {} as Pool;

const mockedPool = vi.mocked(Pool);
mockedPool.mockImplementation(function() { return fakePool; });


describe('CogReader', () => {

  beforeEach(() => {
    mockedPool.mockClear();
    mockedFromUrl.mockClear();
    fakeFirstImage.fileDirectory.loadValue.mockClear();
    fakeOverview.fileDirectory.loadValue.mockClear();
    fakeOverviewReadRasters.mockClear();
    fakeMaskImage.fileDirectory.loadValue.mockClear();
    fakeMaskReadRasters.mockClear();
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
    // Overview (zoom 18) is the lowest zoom >= z=15 so it wins over the main image (zoom 19).
    expect(fakeOverviewReadRasters).toHaveBeenCalledWith(expect.objectContaining({
      window: expect.any(Array),
      width: 256,
      height: 256,
      interleave: true,
      resampleMethod: 'nearest',
      pool: fakePool,
      fillValue: 1,
    }));
  });

  test('getRawTile returns the cached tile on subsequent calls, skipping readRasters', async () => {
    const readRasters = vi.fn(() => Promise.resolve(fakeReadRasterResult));
    mockedFromUrl.mockReturnValueOnce(Promise.resolve({
      ...fakeGeoTIFF,
      // @ts-expect-error partial mock
      getImage: (index?: number) => Promise.resolve(index === 1 ? {...fakeOverview, readRasters} : fakeFirstImage),
    }));

    const reader = CogReader('tile-cache.tif');
    await reader.getRawTile({z: 15, x: 16550, y: 12213});
    await reader.getRawTile({z: 15, x: 16550, y: 12213});

    expect(readRasters).toHaveBeenCalledTimes(1);
  });

  test('getRawTile with {mask: true} returns null when the COG has no mask images', async () => {
    // 'file.tif' metadata is already cached with no mask images (two non-mask images).
    const result = await CogReader('file.tif').getRawTile({z: 15, x: 16550, y: 12213}, {mask: true});
    expect(result).toBeNull();
  });

  test('getRawTile with {mask: true} reads the mask tile when a mask image is present', async () => {
    mockedFromUrl.mockReturnValueOnce(Promise.resolve(fakeGeoTIFFWithMask));

    const result = await CogReader('with-mask.tif').getRawTile({z: 15, x: 16550, y: 12213}, {mask: true});

    expect(result).toBeDefined();
    expect(fakeMaskReadRasters).toHaveBeenCalledTimes(1);
    expect(fakeMaskReadRasters).toHaveBeenCalledWith(expect.objectContaining({
      width: 256,
      height: 256,
      interleave: true,
      resampleMethod: 'nearest',
      fillValue: 0,
    }));
  });

  test('getRawTile with {mask: true} returns the cached mask tile on subsequent calls, skipping readRasters', async () => {
    mockedFromUrl.mockReturnValueOnce(Promise.resolve(fakeGeoTIFFWithMask));

    const reader = CogReader('mask-cache.tif');
    await reader.getRawTile({z: 15, x: 16550, y: 12213}, {mask: true});
    await reader.getRawTile({z: 15, x: 16550, y: 12213}, {mask: true});

    expect(fakeMaskReadRasters).toHaveBeenCalledTimes(1);
  });

  test('getMetadata applies default offset/scale and omits bitsPerSample and colorMap when the tags are absent', async () => {
    mockedFromUrl.mockReturnValueOnce(Promise.resolve({
      ...fakeGeoTIFF,
      // @ts-expect-error partial mock
      getImage: (index?: number) => Promise.resolve(index === 1 ? fakeOverview : {
        ...fakeFirstImage,
        getGDALMetadata: async () => null,
        fileDirectory: {
          loadValue: vi.fn(async (tag: string | number) => {
            if (tag === 'Artist') return undefined;
            if (tag === 'PhotometricInterpretation') return 2;
            if (tag === 'NewSubfileType') return 0;
            return undefined; // no BitsPerSample, no ColorMap
          }),
        },
      }),
    }));

    const metadata = await CogReader('no-gdal.tif').getMetadata();

    expect(metadata.offset).toBe(0);
    expect(metadata.scale).toBe(1);
    expect(metadata.bitsPerSample).toBeUndefined();
    expect(metadata.colorMap).toBeUndefined();
  });

  test('getRawTile uses Infinity as fillValue when noData is absent', async () => {
    const readRasters = vi.fn(() => Promise.resolve(fakeReadRasterResult));
    mockedFromUrl.mockReturnValueOnce(Promise.resolve({
      // @ts-expect-error partial mock
      ...fakeGeoTIFF,
      getImage: (index?: number) => Promise.resolve(index === 1
        ? {...fakeOverview, readRasters}
        : {...fakeFirstImage, getGDALNoData: () => null}
      ),
    }));

    await CogReader('no-nodata.tif').getRawTile({z: 15, x: 16550, y: 12213});

    expect(readRasters).toHaveBeenCalledWith(expect.objectContaining({fillValue: Infinity}));
  });

  test('getRawTile uses Infinity as fillValue when noData is NaN', async () => {
    const readRasters = vi.fn(() => Promise.resolve(fakeReadRasterResult));
    mockedFromUrl.mockReturnValueOnce(Promise.resolve({
      // @ts-expect-error partial mock
      ...fakeGeoTIFF,
      getImage: (index?: number) => Promise.resolve(index === 1
        ? {...fakeOverview, readRasters}
        : {...fakeFirstImage, getGDALNoData: () => NaN}
      ),
    }));

    await CogReader('nan-nodata.tif').getRawTile({z: 15, x: 16550, y: 12213});

    expect(readRasters).toHaveBeenCalledWith(expect.objectContaining({fillValue: Infinity}));
  });

  test('getRawTile with {mask: true} selects the mask image with the lowest zoom >= z', async () => {
    const readRastersZoom15 = vi.fn(() => Promise.resolve(new Uint8Array(65536)));
    const readRastersZoom19 = vi.fn(() => Promise.resolve(new Uint8Array(65536)));

    const maskImage = (resolution: number, readRasters: ReturnType<typeof vi.fn>) => ({
      fileDirectory: {loadValue: vi.fn(async (tag: string | number) => tag === 'NewSubfileType' ? 4 : undefined)},
      getResolution: () => [resolution],
      getWidth: () => 256,
      getHeight: () => 256,
      readRasters,
    });

    mockedFromUrl.mockReturnValueOnce(Promise.resolve({
      // @ts-expect-error partial mock — 4 images: base, overview, mask@zoom15, mask@zoom19
      getImage: (index?: number) => {
        if (index === 2) return Promise.resolve(maskImage(4.777314267823516, readRastersZoom15));
        if (index === 3) return Promise.resolve(maskImage(0.29858214173896974, readRastersZoom19));
        if (index === 1) return Promise.resolve(fakeOverview);
        return Promise.resolve(fakeFirstImage);
      },
      getImageCount: () => Promise.resolve(4),
      readRasters: vi.fn(() => Promise.resolve(fakeReadRasterResult)),
    }));

    // z=16: lowest zoom >= 16 is zoom 19 → zoom 19 mask wins (zoom 15 < 16 is not a candidate)
    await CogReader('two-masks.tif').getRawTile({z: 16, x: 0, y: 0}, {mask: true});

    expect(readRastersZoom19).toHaveBeenCalledTimes(1);
    expect(readRastersZoom15).not.toHaveBeenCalled();
  });

});
