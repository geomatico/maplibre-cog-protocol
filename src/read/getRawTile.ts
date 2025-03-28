import { TypedArray } from 'geotiff';
import QuickLRU from 'quick-lru';
import { ONE_HOUR_IN_MILLISECONDS, TILE_SIZE } from '../constants';
import { TileIndex } from '../types';
import { getGeoTiff } from './getGeoTiff';
import { getMetadata } from './getMetadata';
import { tileIndexToMercatorBbox } from './math';

const tileCache = new QuickLRU<string, Promise<TypedArray[]>>({
  maxSize: 1024,
  maxAge: ONE_HOUR_IN_MILLISECONDS,
});

export async function getRawTile(url: string, { z, x, y }: TileIndex, tileSize: number = TILE_SIZE): Promise<TypedArray[]> {
  const key = `${url}/${tileSize}/${z}/${x}/${y}`;

  const cachedTile = tileCache.get(key);

  if (cachedTile) {
    return cachedTile;
  }

  const tiff = await getGeoTiff(url);
  const { noData } = await getMetadata(url);

  // FillValue won't accept NaN.
  // Infinity will work for Float32Array and Float64Array.
  // Int and Uint arrays will be filled with zeroes.
  const fillValue = noData === undefined || isNaN(noData) ? Infinity : noData;

  const tile = tiff.readRasters({
    bbox: tileIndexToMercatorBbox({ x, y, z }),
    width: tileSize,
    height: tileSize,
    fillValue, // When fillValue is Infinity, integer types will be filled with a 0 value.
  }) as Promise<TypedArray[]>; // ReadRasterResult extends TypedArray[]

  tileCache.set(key, tile);

  return tile;
}
