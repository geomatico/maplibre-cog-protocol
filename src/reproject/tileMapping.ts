import {RasterReprojector, type ReprojectionFns} from '@developmentseed/raster-reproject';

import {TILE_SIZE} from '../constants';
import {tileIndexToMercatorBbox} from '../read/math';
import type {TileIndex} from '../types';
import type {Reprojection} from './georeference';

/** Maximum distance, in tile pixels, between the mesh and the exact projection. */
const MAX_MESH_ERROR = 0.125;

/**
 * Where each pixel of a Web Mercator tile comes from in the COG.
 *
 * Positions are fractions of the COG's extent, so they hold for the full resolution image and for
 * every overview alike: `u` runs 0 to 1 from the west to the east edge, `v` 0 to 1 from the north
 * to the south edge. They are NaN where the projection has no answer.
 */
export type TileMapping = {
  u: Float64Array;
  v: Float64Array;
  /** 1 where the pixel falls inside the COG's extent, 0 where it does not. */
  footprint: Uint8Array;
  /** [uMin, vMin, uMax, vMax] of the pixels inside the COG, or undefined if there are none. */
  bounds?: [number, number, number, number];
};

const NOT_A_NUMBER: [number, number] = [Number.NaN, Number.NaN];

/** proj4 throws or yields garbage away from a projection's domain; the mesh wants NaN instead. */
const safely =
  (convert: (x: number, y: number) => [number, number]) =>
  (x: number, y: number): [number, number] => {
    try {
      const result = convert(x, y);
      return Number.isFinite(result[0]) && Number.isFinite(result[1]) ? result : NOT_A_NUMBER;
    } catch {
      return NOT_A_NUMBER;
    }
  };

const EARTH_RADIUS = 6378137;
const DEGREES = 180 / Math.PI;

/** Does the tile overlap the COG's geographic bounding box? Cheap test that skips the mesh. */
const overlapsCog = (tile: TileIndex, [west, south, east, north]: number[]): boolean => {
  const [xMin, yMin, xMax, yMax] = tileIndexToMercatorBbox(tile);
  const lat = (y: number) => (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * DEGREES;
  const margin = 0.01; // degrees: bounding boxes of curved edges are only sampled
  return (
    (xMax / EARTH_RADIUS) * DEGREES >= west - margin &&
    (xMin / EARTH_RADIUS) * DEGREES <= east + margin &&
    lat(yMax) >= south - margin &&
    lat(yMin) <= north + margin
  );
};

/**
 * Builds the mapping from the pixels of a Web Mercator tile to positions in a COG of another CRS.
 *
 * Projecting 65,536 pixels one by one would work but is slow, so this follows the approach of
 * deck.gl-raster: a mesh of triangles whose corners are projected exactly, and a straight
 * interpolation inside each triangle. `RasterReprojector` adds corners only where the straight
 * interpolation drifts further than `MAX_MESH_ERROR` pixels, so smooth projections like the Irish
 * Grid need a handful of triangles per tile.
 *
 * deck.gl-raster meshes the *source* image and lets the GPU draw it into the map. Without a GPU
 * the other direction is the convenient one: mesh the *tile*, treating its Web Mercator grid as
 * the "input" image and the COG's CRS as the "output", so that every tile pixel lands inside
 * exactly one triangle and none is left as a hole.
 */
export const buildTileMapping = (tile: TileIndex, {projection, extent, geographicBbox}: Reprojection): TileMapping => {
  const u = new Float64Array(TILE_SIZE * TILE_SIZE).fill(Number.NaN);
  const v = new Float64Array(TILE_SIZE * TILE_SIZE).fill(Number.NaN);
  const footprint = new Uint8Array(TILE_SIZE * TILE_SIZE);
  const mapping: TileMapping = {u, v, footprint};

  if (!overlapsCog(tile, geographicBbox)) return mapping;

  const [west, south, east, north] = tileIndexToMercatorBbox(tile);
  const pixelWidth = (east - west) / TILE_SIZE;
  const pixelHeight = (north - south) / TILE_SIZE;
  const [xMin, yMin, xMax, yMax] = extent;

  // Mesh coordinates are tile pixel *corners* (0 to TILE_SIZE), hence TILE_SIZE + 1 grid points.
  const reprojectors: ReprojectionFns = {
    forwardTransform: (px, py) => [west + px * pixelWidth, north - py * pixelHeight],
    inverseTransform: (x, y) => [(x - west) / pixelWidth, (north - y) / pixelHeight],
    forwardReproject: safely(projection.fromWebMercator),
    inverseReproject: safely(projection.toWebMercator),
  };

  const mesh = new RasterReprojector(reprojectors, TILE_SIZE + 1, TILE_SIZE + 1);
  mesh.run(MAX_MESH_ERROR, {maxIterations: 2000});

  // Vertices: tile pixel corner coordinates, and position inside the COG's extent.
  const vertexCount = mesh.uvs.length / 2;
  const vertexX = new Float64Array(vertexCount);
  const vertexY = new Float64Array(vertexCount);
  const vertexU = new Float64Array(vertexCount);
  const vertexV = new Float64Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) {
    vertexX[i] = mesh.uvs[2 * i] * TILE_SIZE;
    vertexY[i] = mesh.uvs[2 * i + 1] * TILE_SIZE;
    vertexU[i] = (mesh.exactOutputPositions[2 * i] - xMin) / (xMax - xMin);
    vertexV[i] = (yMax - mesh.exactOutputPositions[2 * i + 1]) / (yMax - yMin);
  }

  const EPSILON = 1e-9; // pixels on the edge between two triangles belong to both
  const {triangles} = mesh;
  for (let t = 0; t < triangles.length; t += 3) {
    const a = triangles[t];
    const b = triangles[t + 1];
    const c = triangles[t + 2];

    const ax = vertexX[a];
    const ay = vertexY[a];
    const bx = vertexX[b];
    const by = vertexY[b];
    const cx = vertexX[c];
    const cy = vertexY[c];

    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (area === 0) continue;

    // A corner the projection could not place leaves its triangle unmapped, i.e. transparent.
    if (!Number.isFinite(vertexU[a] + vertexV[a] + vertexU[b] + vertexV[b] + vertexU[c] + vertexV[c])) continue;

    const firstColumn = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 0.5));
    const lastColumn = Math.min(TILE_SIZE - 1, Math.ceil(Math.max(ax, bx, cx) - 0.5));
    const firstRow = Math.max(0, Math.floor(Math.min(ay, by, cy) - 0.5));
    const lastRow = Math.min(TILE_SIZE - 1, Math.ceil(Math.max(ay, by, cy) - 0.5));

    for (let row = firstRow; row <= lastRow; row++) {
      const py = row + 0.5;
      for (let column = firstColumn; column <= lastColumn; column++) {
        const px = column + 0.5;

        // Barycentric weights of the pixel centre
        const wb = ((px - ax) * (cy - ay) - (cx - ax) * (py - ay)) / area;
        const wc = ((bx - ax) * (py - ay) - (px - ax) * (by - ay)) / area;
        const wa = 1 - wb - wc;
        if (wa < -EPSILON || wb < -EPSILON || wc < -EPSILON) continue;

        const index = row * TILE_SIZE + column;
        u[index] = wa * vertexU[a] + wb * vertexU[b] + wc * vertexU[c];
        v[index] = wa * vertexV[a] + wb * vertexV[b] + wc * vertexV[c];
      }
    }
  }

  let uMin = Infinity;
  let vMin = Infinity;
  let uMax = -Infinity;
  let vMax = -Infinity;
  for (let i = 0; i < u.length; i++) {
    if (u[i] >= 0 && u[i] < 1 && v[i] >= 0 && v[i] < 1) {
      footprint[i] = 1;
      if (u[i] < uMin) uMin = u[i];
      if (u[i] > uMax) uMax = u[i];
      if (v[i] < vMin) vMin = v[i];
      if (v[i] > vMax) vMax = v[i];
    }
  }
  if (uMin <= uMax) mapping.bounds = [uMin, vMin, uMax, vMax];

  return mapping;
};
