import {LatLonZoom, TypedArray} from '@/types';
import CogReader from '@/read/CogReader';
import {tilePixelLocationFromLatLonZoom} from '@/read/math';
import {TILE_SIZE} from '@/cogProtocol';

const getLocationValues = async (url: string, {latitude, longitude, zoom}: LatLonZoom): Promise<Array<number>> => {
  const cog = CogReader(url);

  const {minzoom, maxzoom} = await cog.getTilejson(url);
  const {noData} = await cog.getMetadata();

  const normalizedZoom = Math.max(minzoom, Math.min(maxzoom, Math.round(zoom)));

  const {tileIndex, dx, dy} = tilePixelLocationFromLatLonZoom({latitude, longitude, zoom: normalizedZoom});

  const tile = await cog.getRawTile(tileIndex);

  return tile.map((band: TypedArray) => {
    const rawValue = band[dy * TILE_SIZE + dx];
    if (rawValue === Infinity || rawValue === noData) {
      return NaN;
    } else {
      return rawValue;
    }
  });
}

export {getLocationValues};
