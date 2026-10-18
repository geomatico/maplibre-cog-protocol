import {describe, expect, test} from 'vitest';

import {detectReprojection} from '../../src/reproject/georeference';
import {getProjection, registerProjection} from '../../src/reproject/projections';

const EXTENT: [number, number, number, number] = [300000, 330000, 351200, 381200];

describe('EPSG:29902 (TM65 / Irish Grid)', () => {
  const irishGrid = getProjection(29902)!;

  // Reference values from PROJ (pyproj 3, Transformer.from_crs(29902, 4326/3857)), which for this CRS
  // uses the same "TM65 to WGS 84 (2)" Helmert transformation, 1 m accurate according to EPSG.
  test.each([
    [333000, 334000, -5.960858218956, 54.237627507313, -663559.7016, 7215289.1697],
    [315904.18, 234671.07, -6.260245791219, 53.349796595334, -696887.3737, 7047964.7566],
    [200000, 250000, -8.000738627847, 53.500211608855, -890638.15, 7076064.8783],
  ])('(%d, %d) is at longitude %d, latitude %d, and x %d, y %d in Web Mercator', (e, n, lon, lat, x, y) => {
    const [actualLon, actualLat] = irishGrid.toLonLat(e, n);
    expect(actualLon).toBeCloseTo(lon, 8);
    expect(actualLat).toBeCloseTo(lat, 8);

    const [actualX, actualY] = irishGrid.toWebMercator(e, n);
    expect(actualX).toBeCloseTo(x, 3);
    expect(actualY).toBeCloseTo(y, 3);
  });

  test('applies the datum shift: TM65 is tens of metres away from WGS84', () => {
    // Without the Helmert shift the same Irish Grid point would land ~70 m away (checked on proj4's
    // own datum-less result), so this guards against an EPSG definition that lacks +towgs84.
    const [lon, lat] = irishGrid.toLonLat(200000, 250000);
    expect(lon).toBeCloseTo(-8.0007386, 6); // not -8.0000: the false origin is on the TM65 datum
    expect(lat).toBeCloseTo(53.5002116, 6); // not 53.5000
  });

  test('inverse is the exact opposite of forward', () => {
    const [x, y] = irishGrid.toWebMercator(325000, 355000);
    const [e, n] = irishGrid.fromWebMercator(x, y);
    expect(e).toBeCloseTo(325000, 2); // proj4's iterative inverse is good to about a millimetre
    expect(n).toBeCloseTo(355000, 2);
  });
});

describe('detectReprojection', () => {
  test.each([[{ProjectedCSTypeGeoKey: 3857}], [{ProjectedCSTypeGeoKey: 102113}], [{}], [undefined], [null]])(
    'leaves Web Mercator (or CRS-less) COGs alone: %j',
    (geoKeys) => {
      expect(detectReprojection('a.tif', geoKeys, EXTENT, false)).toBeUndefined();
    },
  );

  test('knows EPSG:29902, EPSG:2157 and EPSG:4326', () => {
    expect(detectReprojection('a.tif', {ProjectedCSTypeGeoKey: 29902}, EXTENT, false)?.crs).toBe('EPSG:29902');
    expect(detectReprojection('a.tif', {ProjectedCSTypeGeoKey: 2157}, EXTENT, false)?.crs).toBe('EPSG:2157');
    expect(detectReprojection('a.tif', {GeographicTypeGeoKey: 4326}, [-7, 54, -6, 55], false)?.crs).toBe('EPSG:4326');
  });

  test('prefers the projected CRS over the geographic one a projected COG also declares', () => {
    const geoKeys = {ProjectedCSTypeGeoKey: 29902, GeographicTypeGeoKey: 4299};
    expect(detectReprojection('a.tif', geoKeys, EXTENT, false)?.crs).toBe('EPSG:29902');
  });

  test('computes the geographic bounding box of the extent', () => {
    const {geographicBbox} = detectReprojection('a.tif', {ProjectedCSTypeGeoKey: 29902}, EXTENT, false)!;
    // From PROJ, over the corners of the extent
    expect(geographicBbox[0]).toBeCloseTo(-6.4681, 3);
    expect(geographicBbox[1]).toBeCloseTo(54.1967, 3);
    expect(geographicBbox[2]).toBeCloseTo(-5.6579, 3);
    expect(geographicBbox[3]).toBeCloseTo(54.669, 3);
  });

  test('explains how to register a CRS it does not know', () => {
    expect(() => detectReprojection('a.tif', {ProjectedCSTypeGeoKey: 27700}, EXTENT, false)).toThrow(
      /EPSG:27700 in a\.tif is not known\. Register it with registerProjection\(27700/,
    );
  });

  test('registerProjection teaches it a new CRS', () => {
    expect(() => detectReprojection('a.tif', {ProjectedCSTypeGeoKey: 3035}, EXTENT, false)).toThrow(/not known/);

    registerProjection(
      3035,
      '+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
    );

    const reprojection = detectReprojection('a.tif', {ProjectedCSTypeGeoKey: 3035}, [3200000, 3000000, 3300000, 3100000], false);
    expect(reprojection?.crs).toBe('EPSG:3035');
    const [lon, lat] = reprojection!.projection.toLonLat(4321000, 3210000);
    expect(lon).toBeCloseTo(10, 6);
    expect(lat).toBeCloseTo(52, 6);
  });

  test('rejects user-defined CRSs, which carry no EPSG code to look up', () => {
    expect(() => detectReprojection('a.tif', {ProjectedCSTypeGeoKey: 32767}, EXTENT, false)).toThrow(/user-defined/);
  });

  test('rejects rotated COGs, which an axis-aligned extent cannot describe', () => {
    expect(() => detectReprojection('a.tif', {ProjectedCSTypeGeoKey: 29902}, EXTENT, true)).toThrow(/rotated/);
  });
});
