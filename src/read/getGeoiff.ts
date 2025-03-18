import GeoTIFF, { fromUrl } from 'geotiff';
import QuickLRU from 'quick-lru';
import { ONE_HOUR_IN_MILLISECONDS } from '../constants';

const geoTiffCache = new QuickLRU<string, Promise<GeoTIFF>>({
  maxSize: 16,
  maxAge: ONE_HOUR_IN_MILLISECONDS,
});

export function getGeoTiff(url: string): Promise<GeoTIFF> {
  const cachedGeoTiff = geoTiffCache.get(url);

  if (cachedGeoTiff) {
    return cachedGeoTiff;
  }

  const geoTiff = fromUrl(url);

  geoTiffCache.set(url, geoTiff);

  return geoTiff;
}
