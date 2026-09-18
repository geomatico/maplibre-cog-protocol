import {noDataTest} from '../noData';
import type {CogMetadata, ImageRenderer, TypedArray} from '../types';
import * as rgba from './rgba';

export enum PhotometricInterpretations {
  WhiteIsZero = 0,
  BlackIsZero = 1,
  RGB = 2,
  Palette = 3,
  TransparencyMask = 4,
  CMYK = 5,
  YCbCr = 6,
  CIELab = 8,
  ICCLab = 9,
}

type Options = CogMetadata;

export const renderPhoto: ImageRenderer<Options> = (
  raster: TypedArray,
  {noData, photometricInterpretation, bitsPerSample, colorMap},
): Uint8ClampedArray<ArrayBuffer> => {
  const max = bitsPerSample?.[0] ? 2 ** bitsPerSample[0] : NaN;
  // A COG that declares no noData value has no transparent pixels, as in GDAL. Guessing 0 would
  // make genuinely black pixels, or the first entry of a color table, silently disappear.
  const isNoData = noDataTest(noData, raster);

  let data: Uint8ClampedArray<ArrayBuffer>;
  switch (photometricInterpretation) {
    case PhotometricInterpretations.WhiteIsZero:
      data = rgba.fromWhiteIsZero(raster, max, isNoData);
      break;
    case PhotometricInterpretations.BlackIsZero:
      data = rgba.fromBlackIsZero(raster, max, isNoData);
      break;
    case PhotometricInterpretations.RGB:
      data = rgba.fromRGB(raster, isNoData);
      break;
    case PhotometricInterpretations.Palette:
      if (colorMap) {
        data = rgba.fromPalette(raster, colorMap, isNoData);
      } else {
        throw new Error('colorMap for paletted image not found.');
      }
      break;
    case PhotometricInterpretations.CMYK:
      data = rgba.fromCMYK(raster, isNoData);
      break;
    case PhotometricInterpretations.YCbCr:
      data = rgba.fromYCbCr(raster, isNoData);
      break;
    case PhotometricInterpretations.CIELab:
      data = rgba.fromCIELab(raster, isNoData);
      break;
    default:
      throw new Error('Unsupported photometric interpretation.');
  }
  return data;
};

export default renderPhoto;
