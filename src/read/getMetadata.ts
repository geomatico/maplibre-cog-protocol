import QuickLRU from 'quick-lru';
import { ONE_HOUR_IN_MILLISECONDS } from '../constants';
import { Bbox, CogMetadata, ImageMetadata } from '../types';
import { getGeoTiff } from './getGeoTiff';
import { mercatorBboxToGeographicBbox, zoomFromResolution } from './math';

const metadataCache = new QuickLRU<string, CogMetadata>({
  maxSize: 16,
  maxAge: ONE_HOUR_IN_MILLISECONDS,
});

export async function getMetadata(url: string): Promise<CogMetadata> {
  const cachedMetadata = metadataCache.get(url);

  if (cachedMetadata) {
    return cachedMetadata;
  }

  const tiff = await getGeoTiff(url);
  const firstImage = await tiff.getImage();
  const gdalMetadata = firstImage.getGDALMetadata(0); // Metadata for first image and first sample
  const fileDirectory = firstImage.fileDirectory;
  const artist = firstImage.fileDirectory?.Artist;
  const imageBbox = firstImage.getBoundingBox() as Bbox;
  const bbox = mercatorBboxToGeographicBbox(imageBbox);

  const imagesMetadata: Array<ImageMetadata> = [];

  const imageCount = await tiff.getImageCount();

  const zooms: number[] = [];

  for (let index = 0; index < imageCount; index++) {
    const image = await tiff.getImage(index);
    const zoom = zoomFromResolution(image.getResolution(firstImage)[0]);
    const isOverview = !!(image.fileDirectory.NewSubfileType & 1);
    const isMask = !!(image.fileDirectory.NewSubfileType & 4);
    imagesMetadata.push({ zoom, isOverview, isMask });

    zooms.push(zoom);
  }

  const minzoom = Math.round(Math.min(...zooms));
  const maxzoom = Math.round(Math.max(...zooms));

  const metadata: CogMetadata = {
    offset: gdalMetadata?.OFFSET !== undefined ? parseFloat(gdalMetadata.OFFSET) : 0.0,
    scale: gdalMetadata?.SCALE !== undefined ? parseFloat(gdalMetadata.SCALE) : 1.0,
    noData: firstImage.getGDALNoData() ?? undefined,
    photometricInterpretation: fileDirectory?.PhotometricInterpretation,
    bitsPerSample: fileDirectory?.BitsPerSample,
    colorMap: fileDirectory?.ColorMap,
    artist,
    bbox,
    images: imagesMetadata,
    minzoom,
    maxzoom,
  };

  metadataCache.set(url, metadata);

  return metadata;
}
