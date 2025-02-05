import { GeoTIFF, GeoTIFFImage, ReadRasterResult } from 'geotiff';
import { PhotometricInterpretations } from '../../../src/render/renderPhoto';
import { fakeRawTile } from './fakeRawTile.mock';

// @ts-expect-error only implementing used properties
const fakeFirstImage: GeoTIFFImage = {
  fileDirectory: {
    PhotometricInterpretation: PhotometricInterpretations.RGB,
    BitsPerSample: [8, 8, 8],
    Artist: 'Geomatico',
  },
  getBoundingBox: () => [201640.881, 5098655.535, 206532.85, 5102018.764],
  getGDALMetadata: () => ({
    OFFSET: '1.2',
    SCALE: '3.4',
  }),
  getGDALNoData: () => 1,
  getResolution: () => [0.29858214173896974],
};

// @ts-expect-error only implementing used properties
const fakeOverview: GeoTIFFImage = {
  getResolution: () => [0.5971642834779395],
  fileDirectory: {
    NewSubfileType: 1, // 1 = overview, 4 = mask, 5 = overview-mask
  },
};

const fakeReadRasterResult: ReadRasterResult = fakeRawTile as ReadRasterResult;

// @ts-expect-error only implementing used properties
export const fakeGeoTIFF: GeoTIFF = {
  getImage: (index?: number) => Promise.resolve(index === 1 ? fakeOverview : fakeFirstImage),
  getImageCount: () => Promise.resolve(2), // A base image and an overview
  readRasters: jest.fn(() => Promise.resolve(fakeReadRasterResult)),
};
