import { getGeoTiff } from '../../src/read/getGeoTiff';
import { mockedFromUrl } from './mocks/fromUrl.mock';

import './mocks/fromUrl.mock';

jest.mock('geotiff');

describe('getGeoTiff', () => {
  test('getGeoTiff gets a GeoTiff and caches it based on its URL', () => {
    const url = 'file.tif';

    getGeoTiff(url);
    getGeoTiff(url);

    expect(mockedFromUrl).toHaveBeenCalledTimes(1);
    expect(mockedFromUrl).toHaveBeenCalledWith(url);
  });
});
