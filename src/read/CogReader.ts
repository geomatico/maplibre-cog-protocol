import {
  type BlockedSourceOptions,
  fromUrl,
  type GeoTIFF,
  type GeoTIFFImage,
  Pool,
  type RemoteSourceOptions,
} from 'geotiff';
import QuickLRU from 'quick-lru';

import {parseNoData} from '../noData';
import type {Bbox, CogMetadata, ImageMetadata, TileCoverage, TileIndex, TileJSON, TypedArray} from '../types';
import {
  mercatorBboxToGeographicBbox,
  pixelWindowToTileCoverage,
  tileIndexToPixelWindow,
  zoomFromResolution,
} from './math';
import {readTileFast} from './readTile';

const ONE_HOUR_IN_MILLISECONDS = 60 * 60 * 1000;

let pool: Pool;
let requestHeaders: Record<string, string> | undefined;

const geoTiffCache = new QuickLRU<string, Promise<GeoTIFF>>({maxSize: 16, maxAge: ONE_HOUR_IN_MILLISECONDS});
const metadataCache = new QuickLRU<string, Promise<CogMetadata>>({maxSize: 16, maxAge: ONE_HOUR_IN_MILLISECONDS});
const tileCache = new QuickLRU<string, Promise<TypedArray>>({maxSize: 1024, maxAge: ONE_HOUR_IN_MILLISECONDS});

/**
 * Caches a pending promise so concurrent callers share one request, but drops it again if it
 * rejects. Without this a single transient failure — an aborted fetch, a reset connection — would be
 * replayed to every later caller for the full `maxAge`, so that file or tile could never recover
 * without a page reload.
 */
const cacheWhileFulfilled = <T>(cache: QuickLRU<string, Promise<T>>, key: string, value: Promise<T>): Promise<T> => {
  cache.set(key, value);
  value.catch(() => {
    // peek, not get: a failure should not promote whatever currently holds the key.
    if (cache.peek(key) === value) {
      cache.delete(key);
    }
  });
  return value;
};

/**
 * Locates the alpha sample a COG may declare in ExtraSamples (338), which describes the samples
 * beyond the ones the photometric interpretation uses, at the end of every pixel. A value of 1 is
 * associated (premultiplied) alpha, 2 is unassociated alpha, and anything else is not alpha at all.
 */
const alphaSample = (
  extraSamples: ArrayLike<number> | undefined,
  samplesPerPixel: number | undefined,
): {alphaBand?: number; premultipliedAlpha?: boolean} => {
  if (extraSamples === undefined || samplesPerPixel === undefined) return {};

  const values = Array.from(extraSamples);
  const index = values.findIndex((value) => value === 1 || value === 2);
  if (index === -1) return {};

  return {alphaBand: samplesPerPixel - values.length + index, premultipliedAlpha: values[index] === 1};
};

const CogReader = (url: string) => {
  if (pool === undefined) {
    pool = new Pool();
  }

  const getGeoTiff = (url: string): Promise<GeoTIFF> => {
    const cachedGeoTiff = geoTiffCache.get(url);
    if (cachedGeoTiff) {
      return cachedGeoTiff;
    } else {
      const sourceOptions: RemoteSourceOptions & BlockedSourceOptions = {
        blockSize: 65536, // batches/caches byte ranges to cut HTTP requests; 64 kb matches the future geotiff.js default
        ...(requestHeaders ? {headers: requestHeaders} : {}),
      };
      return cacheWhileFulfilled(geoTiffCache, url, fromUrl(url, sourceOptions));
    }
  };

  const getMetadata = async (): Promise<CogMetadata> => {
    const cachedMetadata = metadataCache.get(url);
    if (cachedMetadata) {
      return cachedMetadata;
    } else {
      const tiff = await getGeoTiff(url);
      const firstImage = await tiff.getImage();

      const projectedCSType = firstImage.getGeoKeys()?.ProjectedCSTypeGeoKey;
      if (projectedCSType !== undefined && projectedCSType !== 3857 && projectedCSType !== 102113) {
        throw new Error(
          `COG projection EPSG:${projectedCSType} in ${url} is not supported. Reproject to EPSG:3857 (Web Mercator).`,
        );
      }

      const gdalMetadata = await firstImage.getGDALMetadata(0); // Metadata for first image and first sample
      const fileDirectory = firstImage.fileDirectory;
      const artist = await fileDirectory?.loadValue('Artist');
      const rawNoData = await fileDirectory?.loadValue('GDAL_NODATA');
      const rawBitsPerSample = await fileDirectory?.loadValue('BitsPerSample');
      const rawColorMap = await fileDirectory?.loadValue('ColorMap');
      const rawExtraSamples = await fileDirectory?.loadValue('ExtraSamples');
      const samplesPerPixel = await fileDirectory?.loadValue('SamplesPerPixel');
      const bbox = mercatorBboxToGeographicBbox(firstImage.getBoundingBox() as Bbox);

      const imagesMetadata: Array<ImageMetadata> = [];
      const imageCount = await tiff.getImageCount();
      for (let index = 0; index < imageCount; index++) {
        const image = await tiff.getImage(index);
        const newSubFileType = (await image.fileDirectory.loadValue('NewSubfileType')) ?? 0;
        const zoom = zoomFromResolution(image.getResolution(firstImage)[0]);
        const isOverview = !!(newSubFileType & 1);
        const isMask = !!(newSubFileType & 4);
        imagesMetadata.push({zoom, isOverview, isMask});
      }

      const metadata = {
        offset: gdalMetadata && typeof gdalMetadata.OFFSET === 'string' ? parseFloat(gdalMetadata.OFFSET) : 0.0,
        scale: gdalMetadata && typeof gdalMetadata.SCALE === 'string' ? parseFloat(gdalMetadata.SCALE) : 1.0,
        // The tag is parsed here rather than with getGDALNoData(), which reads "inf"/"-inf" as NaN.
        noData: typeof rawNoData === 'string' ? parseNoData(rawNoData) : (firstImage.getGDALNoData() ?? undefined),
        photometricInterpretation: await fileDirectory?.loadValue('PhotometricInterpretation'),
        bitsPerSample: rawBitsPerSample ? Array.from(rawBitsPerSample) : undefined,
        colorMap: rawColorMap ? Array.from(rawColorMap) : undefined,
        ...alphaSample(rawExtraSamples, samplesPerPixel ?? rawBitsPerSample?.length),
        artist: artist,
        bbox: bbox,
        images: imagesMetadata,
      };

      // @ts-expect-error metadata will be wrapped with a Promise
      metadataCache.set(url, metadata);

      return metadata;
    }
  };

  const getTilejson = async (fullUrl: string): Promise<TileJSON> => {
    const {artist, images, bbox} = await getMetadata();

    const zooms = images.map((image) => image.zoom);

    return {
      tilejson: '2.2.0',
      tiles: [`${fullUrl}/{z}/{x}/{y}`],
      attribution: artist,
      minzoom: 0,
      maxzoom: Math.round(Math.max(...zooms)),
      bounds: bbox,
    };
  };

  /**
   * Index of the image (full resolution image, overview or mask) to read a given zoom level from,
   * or null when the COG has no such image (only reachable for mask images).
   */
  const selectImageIndex = (images: Array<ImageMetadata>, z: number, mask: boolean): number | null => {
    // Filter data or mask images
    const filteredImages = images
      .map((img, index) => ({...img, index}))
      .filter((img) => (mask ? img.isMask : !img.isMask));

    if (filteredImages.length === 0) return null;

    // Pick the closest image to z.
    const aboveZoomImages = filteredImages.filter((img) => Math.round(img.zoom) >= z);
    const bestImage =
      aboveZoomImages.length > 0
        ? aboveZoomImages.reduce((a, b) => (a.zoom < b.zoom ? a : b)) // Closest above z
        : filteredImages.reduce((a, b) => (a.zoom > b.zoom ? a : b)); // Closest below z (fallback)

    return bestImage.index;
  };

  /**
   * Which tile pixels are backed by actual image data. A tile at the border of the COG is only
   * partially covered by it, and the rest of it is filled with the read fillValue, which for
   * integer rasters is indistinguishable from a legitimate value.
   */
  const getTileCoverage = async (
    {z, x, y}: TileIndex,
    {tileSize = 256}: {tileSize?: number} = {},
  ): Promise<TileCoverage> => {
    const {images} = await getMetadata();
    const imageIndex = selectImageIndex(images, z, false);

    if (imageIndex === null) return {left: 0, top: 0, right: 0, bottom: 0};

    const tiff = await getGeoTiff(url);
    const firstImage = await tiff.getImage(0);
    const selectedImage = await tiff.getImage(imageIndex);

    const window = tileIndexToPixelWindow(
      {x, y, z},
      firstImage.getBoundingBox(),
      selectedImage.getWidth(),
      selectedImage.getHeight(),
    );

    return pixelWindowToTileCoverage(window, selectedImage.getWidth(), selectedImage.getHeight(), tileSize);
  };

  /**
   * Reads an interleaved raster, preferring the typed-array shortcut in readTile.ts and falling
   * back to geotiff.js for the layouts it does not cover.
   */
  const readTile = async (
    image: GeoTIFFImage,
    options: {window: [number, number, number, number]; width: number; height: number; fillValue: number; pool: Pool},
  ): Promise<TypedArray> => {
    const fast = await readTileFast(image, options);
    if (fast) return fast;

    const {window, width, height, fillValue} = options;
    // interleaved ReadRasterResult is always a single TypedArray
    return (await image.readRasters({
      window,
      width,
      height,
      interleave: true,
      resampleMethod: 'nearest',
      pool,
      fillValue,
    })) as TypedArray;
  };

  function getRawTile(tileIndex: TileIndex, options?: {mask?: false; tileSize?: number}): Promise<TypedArray>;
  function getRawTile(tileIndex: TileIndex, options: {mask: true; tileSize?: number}): Promise<TypedArray | null>;
  async function getRawTile(
    {z, x, y}: TileIndex,
    {mask = false, tileSize = 256}: {mask?: boolean; tileSize?: number} = {},
  ): Promise<TypedArray | null> {
    const cacheKey = `${url}/${mask ? 'mask/' : 'image/'}${tileSize}/${z}/${x}/${y}`;
    const cachedTile = tileCache.get(cacheKey);
    if (cachedTile !== undefined) return cachedTile;

    const {noData, images} = await getMetadata();

    // FillValue won't accept NaN.
    // Infinity will work for Float32Array and Float64Array.
    // Int and Uint arrays will be filled with zeroes.
    const fillValue = mask ? 0 : noData === undefined || Number.isNaN(noData) ? Infinity : noData;

    const imageIndex = selectImageIndex(images, z, mask);

    if (imageIndex === null) return null; // only reachable when mask=true and COG has no mask band

    const tiff = await getGeoTiff(url);
    const firstImage = await tiff.getImage(0);
    const selectedImage = await tiff.getImage(imageIndex);

    const window = tileIndexToPixelWindow(
      {x, y, z},
      firstImage.getBoundingBox(),
      selectedImage.getWidth(),
      selectedImage.getHeight(),
    );

    const tile = readTile(selectedImage, {window, width: tileSize, height: tileSize, fillValue, pool});

    return cacheWhileFulfilled(tileCache, cacheKey, tile);
  }

  return {getTilejson, getMetadata, getRawTile, getTileCoverage};
};

export const getCogMetadata = (url: string) => CogReader(url).getMetadata();

export const setRequestHeaders = (headers: Record<string, string>) => {
  requestHeaders = headers;
};

export default CogReader;
