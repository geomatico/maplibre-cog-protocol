import { FeatureCollection, Polygon } from 'geojson';
import geomask from 'geomask';
import { getMaskRows, setMask } from '../../src/render/masking';
import { CogMetadata } from '../../src/types';

describe('masking', () => {
  describe('getMaskRows', () => {
    test('if no mask is set it should return undefined', () => {
      const result = getMaskRows(0, { zoomLevelMetadata: new Map() } as CogMetadata);

      expect(result).toBe(undefined);
    });

    test('it should throw an error if the zoom level requested does not exist in the zoom level metadata', () => {
      const polygons: FeatureCollection<Polygon> = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [],
            },
          },
        ],
      };

      setMask(polygons);

      expect(() => getMaskRows(0, { zoomLevelMetadata: new Map() } as CogMetadata)).toThrow(`No zoom metadata found for zoom level 0`);
    });

    test('it should return masking rows for the provided polygons', () => {
      const polygons: FeatureCollection<Polygon> = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [],
            },
          },
        ],
      };

      setMask(polygons);

      const metadata = {
        zoomLevelMetadata: new Map([
          [
            18,
            {
              bbox: [201640.88061629495, 5098655.534734398, 206532.85042654624, 5102018.763978946],
              rasterHeight: 500,
              rasterWidth: 500,
              x: 132391,
              y: 97697,
              z: 18,
            },
          ],
        ]),
      } as CogMetadata;

      const geoMaskSpy = jest.spyOn(geomask, 'inside');

      const result = getMaskRows(18, metadata);
      getMaskRows(18, metadata);

      expect(result?.length).toEqual(500);
      expect(geoMaskSpy).toHaveBeenCalledTimes(1);
    });
  });
});
