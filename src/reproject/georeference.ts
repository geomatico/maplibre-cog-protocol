import {zoomFromResolution} from '../read/math';
import type {Bbox} from '../types';
import {extentToGeographicBbox, getProjection, type Projection, WEB_MERCATOR_CODES} from './projections';

/**
 * How a COG that is not in Web Mercator relates to it: the conversion between its CRS and
 * EPSG:3857, and the rectangle it covers in its own CRS.
 */
export type Reprojection = {
  /** E.g. "EPSG:29902". */
  crs: string;
  projection: Projection;
  /** Extent of the COG in its own CRS: [xMin, yMin, xMax, yMax]. Overviews share it. */
  extent: Bbox;
  /** The same area as [west, south, east, north] degrees. */
  geographicBbox: Bbox;
};

type GeoKeys = {ProjectedCSTypeGeoKey?: number; GeographicTypeGeoKey?: number} | null | undefined;

const USER_DEFINED = 32767;

/**
 * Works out whether a COG needs reprojecting, from its GeoKeys.
 *
 * Returns undefined for Web Mercator COGs (and for COGs without a CRS, which the library has
 * always assumed to be Web Mercator): those are read as they are. Throws when the COG is in a CRS
 * that has not been registered.
 */
export const detectReprojection = (
  url: string,
  geoKeys: GeoKeys,
  extent: Bbox,
  rotated: boolean,
): Reprojection | undefined => {
  const projected = geoKeys?.ProjectedCSTypeGeoKey;
  const epsg = projected !== undefined ? projected : geoKeys?.GeographicTypeGeoKey;

  if (epsg === undefined || WEB_MERCATOR_CODES.includes(epsg)) return undefined;

  if (epsg === USER_DEFINED) {
    throw new Error(
      `COG ${url} uses a user-defined CRS, which is not supported. Reproject it to an EPSG-coded CRS or to EPSG:3857.`,
    );
  }

  const projection = getProjection(epsg);
  if (projection === undefined) {
    throw new Error(
      `COG projection EPSG:${epsg} in ${url} is not known. Register it with registerProjection(${epsg}, '<proj4 definition>') or reproject the COG to EPSG:3857 (Web Mercator).`,
    );
  }

  if (rotated) {
    throw new Error(`COG ${url} is rotated or sheared, which is not supported. Reproject it to a north-up CRS.`);
  }

  return {crs: `EPSG:${epsg}`, projection, extent, geographicBbox: extentToGeographicBbox(projection, extent)};
};

/**
 * Web Mercator zoom level whose resolution matches the pixels of an image of this size, measured
 * at the middle of the COG. A pixel of the Irish Grid at 53.5ºN covers about 1.7 Web Mercator
 * metres per ground metre, so the same pixels belong to a lower zoom than a native Web Mercator
 * COG of the same pixel size would.
 */
export const effectiveZoom = (
  {projection, extent: [xMin, yMin, xMax, yMax]}: Reprojection,
  width: number,
  height: number,
): number => {
  const pixelX = (xMax - xMin) / width;
  const pixelY = (yMax - yMin) / height;
  const x = (xMin + xMax) / 2;
  const y = (yMin + yMax) / 2;

  const [x0, y0] = projection.toWebMercator(x, y);
  const [x1, y1] = projection.toWebMercator(x + pixelX, y);
  const [x2, y2] = projection.toWebMercator(x, y + pixelY);

  const resolution = Math.sqrt(Math.hypot(x1 - x0, y1 - y0) * Math.hypot(x2 - x0, y2 - y0));
  return zoomFromResolution(resolution);
};
