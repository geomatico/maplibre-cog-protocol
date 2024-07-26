import {fromUrl, GeoTIFF, Pool} from 'geotiff';

import {Bbox, CogMetadata, ImageMetadata, TileIndex, TileJSON, TypedArray} from '@/types';

import {
  mercatorBboxToGeographicBbox,
  tileIndexToMercatorBbox,
  zoomFromResolution
} from '@/read/math';


let pool: Pool;
const geoTiffCache: Record<string, Promise<GeoTIFF>> = {};
const metadataCache: Record<string, Promise<CogMetadata>> = {};
const tileCache: Record<string, Promise<TypedArray[]>> = {};

const CogReader = (url: string) => {
  if (pool === undefined) {
    pool = new Pool();
  }

  if (!geoTiffCache[url]) {
    geoTiffCache[url] = fromUrl(url);
  }

  const getMetadata = async (): Promise<CogMetadata> => {
    if (!metadataCache[url]) {
      const tiff = await geoTiffCache[url];
      const firstImage = await tiff.getImage();
      const gdalMetadata = firstImage.getGDALMetadata(0); // Metadata for first image and first sample
      const fileDirectory = firstImage.fileDirectory;
      const artist = firstImage.fileDirectory?.Artist;
      const bbox = mercatorBboxToGeographicBbox(firstImage.getBoundingBox() as Bbox);

      const imagesMetadata: Array<ImageMetadata> = [];
      const imageCount = await tiff.getImageCount();
      for (let index = 0; index < imageCount; index++) {
        const image = await tiff.getImage(index);
        const zoom = zoomFromResolution(image.getResolution(firstImage)[0]);
        const isOverview = !!(image.fileDirectory.NewSubfileType & 1);
        const isMask = !!(image.fileDirectory.NewSubfileType & 4);
        imagesMetadata.push({zoom, isOverview, isMask});
      }

      metadataCache[url] = {
        // @ts-expect-error this will be wrapped with a Promise
        offset: gdalMetadata?.OFFSET !== undefined ? parseFloat(gdalMetadata.OFFSET) : 0.0,
        scale: gdalMetadata?.SCALE !== undefined ? parseFloat(gdalMetadata.SCALE) : 1.0,
        noData: firstImage.getGDALNoData() ?? undefined,
        photometricInterpretation: fileDirectory?.PhotometricInterpretation,
        bitsPerSample: fileDirectory?.BitsPerSample,
        colorMap: fileDirectory?.colorMap,
        artist: artist,
        bbox: bbox,
        images: imagesMetadata
      };
    }

    return metadataCache[url];
  };

  const getTilejson = async (fullUrl: string): Promise<TileJSON> => {
    const {artist, images, bbox} = await getMetadata();

    const zooms = images.map(image => image.zoom);

    return {
      tilejson: '2.2.0',
      tiles: [fullUrl + '/{z}/{x}/{y}'],
      attribution: artist,
      minzoom: Math.round(Math.min(...zooms)),
      maxzoom: Math.round(Math.max(...zooms)),
      bounds: bbox
    };
  };

  const getRawTile = async ({z, x, y}: TileIndex, tileSize: number = 256): Promise<TypedArray[]> => {
    const key = `${url}/${tileSize}/${z}/${x}/${y}`;
    if (!tileCache[key]) {
      const tiff = await geoTiffCache[url];
      const {noData} = await getMetadata();

      // FillValue won't accept NaN.
      // Infinity will work for Float32Array and Float64Array.
      // Int and Uint arrays will be filled with zeroes.
      const fillValue = noData === undefined || isNaN(noData) ? Infinity : noData;

      tileCache[key] = tiff.readRasters({
        bbox: tileIndexToMercatorBbox({x, y, z}),
        width: tileSize,
        height: tileSize,
        interleave: false,
        resampleMethod: 'nearest',
        pool,
        fillValue // When fillValue is Infinity, integer types will be filled with a 0 value.
      }) as Promise<TypedArray[]>;
    }

    return tileCache[key];
  };

  return {getTilejson, getMetadata, getRawTile};
};

export default CogReader;
