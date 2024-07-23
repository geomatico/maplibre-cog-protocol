import {GetResourceResponse, RequestParameters} from 'maplibre-gl';

import CogReader from '@/read/CogReader';
import renderTerrain from '@/render/renderTerrain';
import renderColor from '@/render/renderColor';
import renderPhoto from '@/render/renderPhoto';
import {TileJSON} from '@/types';

export const TILE_SIZE = 256;

const renderTile = async (url: string) => {
  // Read URL parameters
  const re = new RegExp(/cog:\/\/(.+)\/(\d+)\/(\d+)\/(\d+)/);
  const result = url.match(re);
  if (!result) {
    throw new Error(`Invalid COG protocol URL '${url}'`);
  }
  const cogUrl = result[1].split('#')[0];
  const hash = result[1].split('#')[1] ?? '';
  const z = parseInt(result[2]);
  const x = parseInt(result[3]);
  const y = parseInt(result[4]);

  // Read COG data
  const cog = CogReader(cogUrl);
  const rawTile = await cog.getRawTile({z, x, y});
  const metadata = await cog.getMetadata();

  let rgba: Uint8ClampedArray;

  if (hash.startsWith('dem')) {
    rgba = renderTerrain(rawTile, metadata);

  } else if (hash.startsWith('color')) {
    const colorParams = hash.split('color').pop()?.substring(1);
    if (!colorParams) {
      throw new Error('Color params are not defined');
    } else {
      const [colorScheme, minStr, maxStr, modifiers] = colorParams.split(',');
      const min = parseFloat(minStr),
        max = parseFloat(maxStr),
        isReverse = modifiers?.includes('-') || false,
        isContinuous = modifiers?.includes('c') || false;

      rgba = renderColor(rawTile, {...metadata, colorScale: {colorScheme, min, max, isReverse, isContinuous}});
    }
  } else {
    rgba = renderPhoto(rawTile, metadata);
  }

  return await createImageBitmap(
    new ImageData(
      rgba,
      TILE_SIZE,
      TILE_SIZE
    )
  );
};


const cogProtocol = async (params: RequestParameters): Promise<GetResourceResponse<TileJSON | ImageBitmap>> => {
  if (params.type == 'json') {
    const cogUrl = params.url.replace('cog://', '').split('#')[0];
    return {
      data: await CogReader(cogUrl).getTilejson(params.url)
    };
  } else if (params.type == 'image') {
    return {
      data: await renderTile(params.url)
    };
  } else {
    throw new Error(`Unsupported request type '${params.type}'`);
  }
};

export default cogProtocol;
