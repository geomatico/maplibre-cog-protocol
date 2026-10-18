import proj4 from 'proj4';

import type {Bbox} from '../types';

const EARTH_RADIUS = 6378137; // WGS84 semi-major axis, the sphere Web Mercator uses
const DEGREES = 180 / Math.PI;

/** EPSG codes the library reads natively, without reprojecting. */
export const WEB_MERCATOR_CODES: ReadonlyArray<number> = [3857, 102113];

/**
 * proj4 definitions for the CRSs the library knows out of the box.
 *
 * Datum shifts matter: the Irish Grid sits on the TM65 datum, which is tens of metres away from
 * WGS84. The EPSG database's WKT for these CRSs carries no datum shift at all, so the definitions
 * here spell out an explicit `+towgs84` (the 7-parameter Helmert "TM65 to WGS 84", EPSG:1641).
 */
const definitions = new Map<number, string>([
  [4326, '+proj=longlat +datum=WGS84 +no_defs'],
  [
    29902, // TM65 / Irish Grid
    '+proj=tmerc +lat_0=53.5 +lon_0=-8 +k=1.000035 +x_0=200000 +y_0=250000 +a=6377340.189 +b=6356034.446 ' +
      '+towgs84=482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15 +units=m +no_defs',
  ],
  [
    2157, // IRENET95 / Irish Transverse Mercator
    '+proj=tmerc +lat_0=53.5 +lon_0=-8 +k=0.99982 +x_0=600000 +y_0=750000 +ellps=GRS80 ' +
      '+towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  ],
]);

/**
 * Teach the library a CRS it does not know, so COGs using it can be reprojected.
 *
 * @param epsg EPSG code, as stored in the COG's GeoKeys (e.g. 27700).
 * @param definition A proj4 string or a WKT string.
 */
export const registerProjection = (epsg: number, definition: string): void => {
  definitions.set(epsg, definition);
  projectionCache.delete(epsg);
};

/** A coordinate conversion between a COG's CRS and Web Mercator (EPSG:3857). */
export type Projection = {
  /** Source CRS to EPSG:3857 metres. */
  toWebMercator: (x: number, y: number) => [number, number];
  /** EPSG:3857 metres to source CRS. */
  fromWebMercator: (x: number, y: number) => [number, number];
  /** Source CRS to [longitude, latitude] degrees. */
  toLonLat: (x: number, y: number) => [number, number];
};

const mercatorToLonLat = (x: number, y: number): [number, number] => [
  (x / EARTH_RADIUS) * DEGREES,
  (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * DEGREES,
];

const lonLatToMercator = (lon: number, lat: number): [number, number] => [
  (lon / DEGREES) * EARTH_RADIUS,
  Math.log(Math.tan(Math.PI / 4 + lat / DEGREES / 2)) * EARTH_RADIUS,
];

const projectionCache = new Map<number, Projection>();

/**
 * The conversion for an EPSG code, or undefined when the CRS is not known.
 *
 * It goes through WGS84 longitude/latitude, so the CRS's datum shift is applied by proj4, and
 * Web Mercator is the spherical formula applied on top. That is also what EPSG:3857 means.
 */
export const getProjection = (epsg: number): Projection | undefined => {
  const cached = projectionCache.get(epsg);
  if (cached) return cached;

  const definition = definitions.get(epsg);
  if (definition === undefined) return undefined;

  const converter = proj4('EPSG:4326', definition);
  const toLonLat = (x: number, y: number): [number, number] => {
    const [lon, lat] = converter.inverse([x, y]);
    return [lon, lat];
  };
  const fromLonLat = (lon: number, lat: number): [number, number] => {
    const [x, y] = converter.forward([lon, lat]);
    return [x, y];
  };

  const projection: Projection = {
    toLonLat,
    toWebMercator: (x, y) => {
      const [lon, lat] = toLonLat(x, y);
      return lonLatToMercator(lon, lat);
    },
    fromWebMercator: (x, y) => {
      const [lon, lat] = mercatorToLonLat(x, y);
      return fromLonLat(lon, lat);
    },
  };
  projectionCache.set(epsg, projection);
  return projection;
};

/** Geographic bounding box [west, south, east, north] of a rectangle given in the source CRS. */
export const extentToGeographicBbox = (projection: Projection, [xMin, yMin, xMax, yMax]: Bbox): Bbox => {
  const STEPS = 32; // the border of a rectangle curves in other projections, so sample along it
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  const include = (x: number, y: number) => {
    const [lon, lat] = projection.toLonLat(x, y);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  };

  for (let i = 0; i <= STEPS; i++) {
    const x = xMin + ((xMax - xMin) * i) / STEPS;
    const y = yMin + ((yMax - yMin) * i) / STEPS;
    include(x, yMin);
    include(x, yMax);
    include(xMin, y);
    include(xMax, y);
  }
  return [west, south, east, north];
};
