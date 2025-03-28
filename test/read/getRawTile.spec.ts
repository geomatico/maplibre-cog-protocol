import { getRawTile } from '../../src/read/getRawTile';
import { fakeGeoTIFF } from './mocks/fakeGeoTiff.mock';
import { fakeRawTile } from './mocks/fakeRawTile.mock';

import './mocks/fromUrl.mock';
import { mockedFromUrl } from './mocks/fromUrl.mock';

jest.mock('geotiff');

describe('getRawTile', () => {
  test('getRawTile reads tile contents', async () => {
    const response = await getRawTile('file.tif', { z: 15, x: 16550, y: 12213 });

    expect(response).toEqual(fakeRawTile);
    expect(fakeGeoTIFF.readRasters).toHaveBeenCalledWith({
      bbox: [203016.7471254281, 5099878.527186957, 204239.73957799093, 5101101.51963952],
      width: 256,
      height: 256,
      fillValue: 1,
    });

    await getRawTile('file.tif', { z: 15, x: 16550, y: 12213 });

    expect(mockedFromUrl).toHaveBeenCalledTimes(1);
  });
});
