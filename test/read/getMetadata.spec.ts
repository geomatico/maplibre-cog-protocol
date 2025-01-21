import { getGeoTiff } from '../../src/read/getGeoTiff';
import { getMetadata } from '../../src/read/getMetadata';
import { fakeGeoTIFF } from './mocks/fakeGeoTiff.mock';

import './mocks/fromUrl.mock';

jest.mock('geotiff');

jest.mock('@/read/getGeoTiff');
const mockedGetGeoTiff = jest.mocked(getGeoTiff);
mockedGetGeoTiff.mockReturnValue(Promise.resolve(fakeGeoTIFF));

describe('getMetadata', () => {
  test('getMetadata returns useful GeoTIFF metadata', async () => {
    const response = await getMetadata('file.tif');

    expect(response).toEqual({
      photometricInterpretation: 2,
      noData: 1,
      offset: 1.2,
      scale: 3.4,
      bitsPerSample: [8, 8, 8],
      artist: 'Geomatico',
      bbox: [1.811370853056256, 41.58257960321504, 1.8553161582776452, 41.60517452144075],
      minzoom: 18,
      maxzoom: 19,
      images: [
        {
          zoom: 19,
          isOverview: false,
          isMask: false,
        },
        {
          zoom: 18,
          isOverview: true,
          isMask: false,
        },
      ],
    });

    await getMetadata('file.tif');

    expect(mockedGetGeoTiff).toHaveBeenCalledTimes(1);
  });
});
