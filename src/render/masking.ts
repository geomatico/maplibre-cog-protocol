import { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import geomask from 'geomask';

import { CogMetadata, MaskRows } from '../types';

// The provided GeoJSON object that will be used to mask the data.
let _mask: FeatureCollection<Polygon | MultiPolygon> | undefined;

const maskCache = new Map<number, MaskRows>();

export function setMask(mask: FeatureCollection<Polygon | MultiPolygon> | undefined): void {
  _mask = mask;

  maskCache.clear();
}

export function clearMask(): void {
  setMask(undefined);
}

export function getMaskRows(zoom: number, { zoomLevelMetadata }: CogMetadata): MaskRows | undefined {
  // No mask set, return undefined;
  if (!_mask) {
    return;
  }

  if (maskCache.has(zoom)) {
    return maskCache.get(zoom);
  }

  const metadata = zoomLevelMetadata.get(zoom);

  if (!metadata) {
    throw new Error(`No zoom metadata found for zoom level ${zoom}`);
  }

  const { rasterHeight, rasterWidth, bbox } = metadata;

  const { rows } = geomask.inside({
    raster_bbox: bbox,
    raster_height: rasterHeight,
    raster_width: rasterWidth,
    mask: _mask,
    raster_srs: 3857,
  });

  maskCache.set(zoom, rows);

  return rows;
}
