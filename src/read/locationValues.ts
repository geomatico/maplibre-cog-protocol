import {Location} from '../types';

import {tilePixelFromLatLonZoom} from './math';
import CogReader from './CogReader';
import {TILE_SIZE} from '../constants';

const locationValues = async (url: string, {latitude, longitude}: Location, zoom?: number): Promise<Array<number>> => {
  const cog = CogReader(url);

  const {minzoom, maxzoom} = await cog.getTilejson(url);
  const {noData, scale, offset} = await cog.getMetadata();

  const normalizedZoom = zoom === undefined ? maxzoom : Math.max(minzoom, Math.min(maxzoom, Math.round(zoom)));

  const {tileIndex, column, row} = tilePixelFromLatLonZoom({latitude, longitude, zoom: normalizedZoom});

  const tile = await cog.getRawTile(tileIndex);
  const pixels = TILE_SIZE * TILE_SIZE;
  const numBands = tile.length / pixels;

  const i = row * TILE_SIZE + column;
  return Array.from(tile.subarray(i * numBands, i * numBands + numBands)).map(rawValue => {
    const px = offset + rawValue * scale;
    if (px === noData || isNaN(px) || px === Infinity) {
      return NaN;
    } else {
      return px;
    }
  });
}

export default locationValues;
