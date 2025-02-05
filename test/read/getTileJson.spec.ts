import { getTileJson } from '../../src/read/getTileJson';

import './mocks/fromUrl.mock';
import { mockedFromUrl } from './mocks/fromUrl.mock';

jest.mock('geotiff');

describe('getTileJson', () => {
  test('getTilejson returns a standard TileJSON document describing GeoTIFF as a data source', async () => {
    const response = await getTileJson('file.tif', 'cog://file.tif#dem');

    expect(response).toEqual({
      tilejson: '2.2.0',
      tiles: ['cog://file.tif#dem/{z}/{x}/{y}'],
      bounds: [1.811370853056256, 41.58257960321504, 1.8553161582776452, 41.60517452144075],
      minzoom: 18,
      maxzoom: 19,
      attribution: 'Geomatico',
    });

    await getTileJson('file.tif', 'cog://file.tif#dem');

    expect(mockedFromUrl).toHaveBeenCalledTimes(1);
  });
});
