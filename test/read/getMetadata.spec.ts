import { getGeoTiff } from '../../src/read/getGeoTiff';
import { getMetadata } from '../../src/read/getMetadata';
import { ZoomMetadata } from '../../src/types';
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
      zoomLevelMetadata: new Map<number, ZoomMetadata>([
        [
          19,
          {
            bbox: [201640.88061629495, 5098655.534734398, 206532.85042654624, 5102018.763978946],
            rasterHeight: 11264,
            rasterWidth: 16384,
            x: 264782,
            y: 195395,
            z: 19,
          },
        ],
        [
          18,
          {
            bbox: [201640.88061629495, 5098655.534734398, 206532.85042654624, 5102018.763978946],
            rasterHeight: 5632,
            rasterWidth: 8192,
            x: 132391,
            y: 97697,
            z: 18,
          },
        ],
      ]),
    });

    await getMetadata('file.tif');

    expect(mockedGetGeoTiff).toHaveBeenCalledTimes(1);
  });
});
