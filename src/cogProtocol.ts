import type {GetResourceResponse, RequestParameters} from 'maplibre-gl';
import {TILE_SIZE} from './constants';
import CogReader from './read/CogReader';
import {applyAlpha} from './render/alpha';
import type {HEXColor} from './render/colorScale';
import {applyCoverage} from './render/coverage';
import CustomRendererStore from './render/custom/rendererStore';
import {applyMask} from './render/mask';
import renderColor from './render/renderColor';
import renderPhoto from './render/renderPhoto';
import renderTerrain from './render/renderTerrain';
import type {TileJSON} from './types';

const renderTile = async (url: string) => {
  // Read URL parameters
  const re = new RegExp(/cog:\/\/(.+)\/(\d+)\/(\d+)\/(\d+)/);
  const result = url.match(re);
  if (!result) {
    throw new Error(`Invalid COG protocol URL '${url}'`);
  }
  const urlParts = result[1].split('#');
  const cogUrl = urlParts[0];

  urlParts.shift();

  const hash = urlParts.join('#') ?? '';
  const z = parseInt(result[2], 10);
  const x = parseInt(result[3], 10);
  const y = parseInt(result[4], 10);

  // Read COG data
  const cog = CogReader(cogUrl);

  // Chained awaits. But parallelizing with Promise.all gave no gain.
  const rawTile = await cog.getRawTile({z, x, y});
  const rawMask = await cog.getRawTile({x, y, z}, {mask: true});
  const metadata = await cog.getMetadata();

  // Transparency has a precedence, the same GDAL applies (RFC 15): a mask band first, then the
  // noData value, then an alpha sample. A COG carrying a mask band states validity there, and
  // honouring its noData too would make genuine noData-coloured pixels disappear, typically the
  // true blacks of a JPEG image whose padding is already masked out.
  const renderMetadata = rawMask ? {...metadata, noData: undefined} : metadata;
  const alphaBand = !rawMask && metadata.noData === undefined ? metadata.alphaBand : undefined;

  let rgba: Uint8ClampedArray<ArrayBuffer>;

  const renderCustom = CustomRendererStore.get(cogUrl);
  const isTerrain = renderCustom === undefined && hash.startsWith('dem');
  if (renderCustom !== undefined) {
    rgba = renderCustom(rawTile, metadata); // a color function gets the COG's own metadata, untouched
  } else if (isTerrain) {
    rgba = renderTerrain(rawTile, renderMetadata);
  } else if (hash.startsWith('color')) {
    const colorParams = hash.split('color').pop()?.substring(1);

    if (!colorParams) {
      throw new Error('Color params are not defined');
    } else {
      const customColorsString = colorParams.match(/\[("#([0-9a-fA-F]{3,6})"(,(\s)?)?)+]/)?.[0];

      let colorScheme: string = '';
      let customColors: Array<HEXColor> = [];
      let minStr: string;
      let maxStr: string;
      let modifiers: string;

      if (customColorsString) {
        customColors = JSON.parse(customColorsString);

        [minStr, maxStr, modifiers] = colorParams.replace(`${customColorsString},`, '').split(',');
      } else {
        [colorScheme, minStr, maxStr, modifiers] = colorParams.split(',');
      }

      const min = parseFloat(minStr),
        max = parseFloat(maxStr),
        isReverse = modifiers?.includes('-') || false,
        isContinuous = modifiers?.includes('c') || false,
        isTransparent = modifiers?.includes('t') || false;

      rgba = renderColor(rawTile, {
        ...renderMetadata,
        colorScale: {colorScheme, customColors, min, max, isReverse, isContinuous, isTransparent},
      });
    }
  } else {
    rgba = renderPhoto(rawTile, renderMetadata);
  }

  if (rawMask) {
    const pixels = TILE_SIZE * TILE_SIZE;
    for (let i = 0; i < pixels; i++) {
      if (rawMask[i] === 0) rgba[i * 4 + 3] = 0;
    }
  }

  // Terrain tiles are opaque by definition: MapLibre reads heights from the RGB channels, and a
  // transparent pixel would lose them. renderTerrain already encodes uncovered pixels as 0 m.
  if (!isTerrain) {
    if (alphaBand !== undefined) {
      applyAlpha(rgba, rawTile, {
        band: alphaBand,
        bitsPerSample: metadata.bitsPerSample?.[alphaBand],
        premultiplied: metadata.premultipliedAlpha,
      });
    }

    applyCoverage(rgba, await cog.getTileCoverage({z, x, y}));
  }

  applyMask(rgba, {x, y, z});
  return await createImageBitmap(new ImageData(rgba, TILE_SIZE, TILE_SIZE));
};

const cogProtocol = async (params: RequestParameters): Promise<GetResourceResponse<TileJSON | ImageBitmap>> => {
  if (params.type === 'json') {
    const cogUrl = params.url.replace('cog://', '').split('#')[0];
    return {
      data: await CogReader(cogUrl).getTilejson(params.url),
    };
  } else if (params.type === 'image') {
    return {
      data: await renderTile(params.url),
    };
  } else {
    throw new Error(`Unsupported request type '${params.type}'`);
  }
};

export default cogProtocol;
