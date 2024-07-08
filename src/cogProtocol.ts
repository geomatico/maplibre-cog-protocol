import {Pool, fromUrl, GeoTIFF} from 'geotiff';
import {RequestParameters} from 'maplibre-gl';

import {computeSamples, toRGB} from './readRGB';
import useColorRamp from '@geomatico/geocomponents/hooks/useColorRamp'; // TODO sacar de geocomponents

/**
 * transform x/y/z to webmercator-bbox
 * @param x
 * @param y
 * @param z
 * @returns {number[]} [minx, miny, maxx, maxy]
 */
const merc = (x: number, y: number, z: number): number[] => {
  // https://qiita.com/MALORGIS/items/1a9114dd090e5b891bf7
  const GEO_R = 6378137;
  const orgX = -1 * ((2 * GEO_R * Math.PI) / 2);
  const orgY = (2 * GEO_R * Math.PI) / 2;
  const unit = (2 * GEO_R * Math.PI) / Math.pow(2, z);
  const minx = orgX + x * unit;
  const maxx = orgX + (x + 1) * unit;
  const miny = orgY - (y + 1) * unit;
  const maxy = orgY - y * unit;
  return [minx, miny, maxx, maxy];
};

const pool = new Pool();

const parseTile = async (url: string, abortController: AbortController) => {
  const re = new RegExp(/cog:\/\/(.+)\/(\d+)\/(\d+)\/(\d+)/);
  const result = url.match(re);
  if (!result) {
    throw new Error('Invalid COG protocol URL');
  }

  const cog_url = result[1].split('#')[0];
  const hash = result[1].split('#')[1];
  const z = parseInt(result[2]);
  const x = parseInt(result[3]);
  const y = parseInt(result[4]);
  const bbox = merc(x, y, z);

  const {signal} = abortController;
  const tiff = await getGeoTIFF(cog_url);
  const image = await tiff.getImage();

  const tileSize: number | undefined = parseInt(image.fileDirectory?.TileWidth) || 512;
  const sampleGdalMetadata = image.getGDALMetadata(0);
  const offset = sampleGdalMetadata?.OFFSET !== undefined ? parseFloat(sampleGdalMetadata.OFFSET) : 0.0;
  const scale = sampleGdalMetadata?.SCALE !== undefined ? parseFloat(sampleGdalMetadata.SCALE) : 1.0;
  const noData = image.getGDALNoData() ?? undefined;
  const fillValue = noData !== undefined ? (noData - offset) / scale :  undefined;
  const samples = computeSamples(image.fileDirectory, true);
  const readRasterResult = await tiff.readRasters({
    bbox,
    width: tileSize,
    height: tileSize,
    samples,
    interleave: true,
    pool,
    signal,
    fillValue
  });

  const pixels = tileSize * tileSize;

  const rgba = new Uint8ClampedArray(4 * pixels);

  if (!hash) {
    //*** This converts any image to rgb and then assigns transparent pixels to NODATA triplets ***//
    const rgb = toRGB(readRasterResult, image.fileDirectory);
    for (let i = 0; i < pixels; i++) {
      rgba[4 * i] = rgb[3 * i];
      rgba[4 * i + 1] = rgb[3 * i + 1];
      rgba[4 * i + 2] = rgb[3 * i + 2];
      rgba[4 * i + 3] = rgb[3 * i] === 0 && rgb[3 * i +1] === 135 && rgb[3 * i +2] === 0 ?
        0 :
        readRasterResult[3 * i] === fillValue && readRasterResult[3 * i + 1] === fillValue && readRasterResult[3 * i + 2] === fillValue ?
          0 :
          255;
    }
  } else {
    if (hash.startsWith('dem')) {
      //*** This converts to terrain rgb ***/
      const base = -10_000;
      const interval = 0.1;

      for (let i = 0; i < pixels; i++) {
        const px = offset + (readRasterResult[i] as number) * scale;
        const h = px == noData ? 0 : px;
        const v = (h - base) / interval;
        rgba[4 * i] = Math.floor(v / 256 / 256) % 256;
        rgba[4 * i + 1] = Math.floor(v / 256) % 256;
        rgba[4 * i + 2] = v % 256;
        rgba[4 * i + 3] = 255;
      }
    } else if (hash.startsWith('color')) {
      //*** This applies a color scale ***/
      const colorParams = url.split('color:').pop();
      if(!colorParams) {
        throw('Color params are not defined');
      } else {
        const [colorScheme, min, max, neg] = colorParams.split(',');
        const colorInterpolator = useColorRamp(colorScheme, [min, max].map(parseFloat), !!neg).d3ScaleInt;
        for (let i = 0; i < pixels; i++) {
          const px = offset + (readRasterResult[i] as number) * scale;
          if (isNaN(px) || px === 0) {
            rgba[4 * i] = 0;
            rgba[4 * i + 1] = 0;
            rgba[4 * i + 2] = 0;
            rgba[4 * i + 3] = 0;
          } else {
            const color = colorInterpolator(px);
            if (color === undefined) console.log(px, color);
            rgba[4 * i] = color[0];
            rgba[4 * i + 1] = color[1];
            rgba[4 * i + 2] = color[2];
            rgba[4 * i + 3] = px === noData ? 0 : 255;
          }
        }
      }
    }
  }

  const imageData = new ImageData(
    rgba,
    tileSize,
    tileSize
  );

  const imageBitmap = await createImageBitmap(imageData);
  return {
    data: imageBitmap,

  };
};

const epsg3857toEpsg4326 = (pos: [number, number]) => {
  // https://developers.auravant.com/en/blog/2022/09/09/post-3/
  let x = pos[0];
  let y = pos[1];
  x = (x * 180) / 20037508.34;
  y = (y * 180) / 20037508.34;
  y = (Math.atan(Math.pow(Math.E, y * (Math.PI / 180))) * 360) / Math.PI - 90;
  return [x, y];
};

const tiffs: Record<string, Promise<GeoTIFF>> = {};
const getGeoTIFF = (url: string): Promise<GeoTIFF> => {
  if (!tiffs[url]) {
    tiffs[url] = fromUrl(url, {blockSize: 16384, cacheSize: 5120});
  }
  return tiffs[url];
};

export interface FetchResponse {
  data: ImageBitmap;
  expires?: string;
  cacheControl?: string;
}

const tiles: Record<string, Promise<FetchResponse>> = {};
const getTile = (url: string, abortController: AbortController): Promise<FetchResponse> => {
  if (!tiles[url]){
    tiles[url] = parseTile(url, abortController);
  }
  return tiles[url];
};

const cogProtocol = async (params: RequestParameters, abortController: AbortController) => {
  if (params.type == 'json') {
    const cog_url = params.url.replace('cog://', '').split('#')[0];
    const tiff = await getGeoTIFF(cog_url);
    const image = await tiff.getImage();
    /*console.log(image.getBoundingBox());
    const count = await tiff.getImageCount();
    for (let i = 0; i < count; i++) {
      const image = await tiff.getImage(i);
      console.log(image);
    }*/

    const attribution = image.fileDirectory?.Artist;
    const tiles = [params.url + '/{z}/{x}/{y}'];
    const maxzoom = parseInt(image.getGDALMetadata()?.ZOOM_LEVEL) || undefined; // Could be computed from image resolution
    const [xmin, ymin, xmax, ymax] = image.getBoundingBox();
    const bounds = [...epsg3857toEpsg4326([xmin, ymin]),...epsg3857toEpsg4326([xmax, ymax])] as [number, number, number, number];

    const tilejson = {
      tilejson: '2.2.0',
      attribution,
      tiles,
      maxzoom,
      bounds,
      vector_layers: [{id: ''}]
    };

    return {data: tilejson};

  } else if (params.type == 'image') {
    const url = params.url;
    return getTile(url, abortController);

  } else {
    throw(params);
  }
};

export default cogProtocol;
