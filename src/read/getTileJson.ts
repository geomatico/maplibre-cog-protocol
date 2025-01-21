import QuickLRU from 'quick-lru';
import { ONE_HOUR_IN_MILLISECONDS } from '../constants';
import { TileJSON } from '../types';
import { getMetadata } from './getMetadata';

const tileJSONCache = new QuickLRU<string, Promise<TileJSON>>({
  maxSize: 16,
  maxAge: ONE_HOUR_IN_MILLISECONDS,
});

export async function getTileJson(url: string, fullUrl: string): Promise<TileJSON> {
  const cachedTileJson = tileJSONCache.get(url);

  if (cachedTileJson) {
    return cachedTileJson;
  } else {
    const { artist, bbox, minzoom, maxzoom } = await getMetadata(url);

    const result: TileJSON = {
      tilejson: '2.2.0',
      tiles: [fullUrl + '/{z}/{x}/{y}'],
      attribution: artist,
      minzoom,
      maxzoom,
      bounds: bbox,
    };

    return result;
  }
}
