import { fromUrl } from 'geotiff';
import { fakeGeoTIFF } from './fakeGeoTiff.mock';

export const mockedFromUrl = jest.mocked(fromUrl);

mockedFromUrl.mockReturnValue(Promise.resolve(fakeGeoTIFF));
