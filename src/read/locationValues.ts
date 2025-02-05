import { Location } from '../types';

import { TypedArray } from 'geotiff';
import { TILE_SIZE } from '../constants';
import { getMetadata } from './getMetadata';
import { getRawTile } from './getRawTile';
import { tilePixelFromLatLonZoom } from './math';

const locationValues = async (url: string, { latitude, longitude }: Location, zoom?: number): Promise<Array<number>> => {
  const { noData, scale, offset, minzoom, maxzoom } = await getMetadata(url);

  const normalizedZoom = zoom === undefined ? maxzoom : Math.max(minzoom, Math.min(maxzoom, Math.round(zoom)));

  const { tileIndex, column, row } = tilePixelFromLatLonZoom({ latitude, longitude, zoom: normalizedZoom });

  const tile = await getRawTile(url, tileIndex);

  return tile.map((band: TypedArray) => {
    const px = offset + band[row * TILE_SIZE + column] * scale;
    if (px === noData || isNaN(px) || px === Infinity) {
      return NaN;
    } else {
      return px;
    }
  });
};

export default locationValues;
