import {CogMetadata, ImageRenderer, TypedArray} from '../types';
import * as rgba from '../render/rgba';

export enum PhotometricInterpretations {
  WhiteIsZero = 0,
  BlackIsZero = 1,
  RGB = 2,
  Palette = 3,
  TransparencyMask = 4,
  CMYK = 5,
  YCbCr = 6,
  CIELab = 8,
  ICCLab= 9
}

type Options = CogMetadata;

export const renderPhoto: ImageRenderer<Options> = (raster: TypedArray[], {noData, photometricInterpretation, bitsPerSample, colorMap}): Uint8ClampedArray => {
  const max = bitsPerSample && bitsPerSample[0] ? 2 ** bitsPerSample[0] : NaN;
  const transparentValue = noData ?? 0; // TODO defaulting to 0 may render some good black pixels transparent.

  let data: Uint8ClampedArray;
  switch (photometricInterpretation) {
  case PhotometricInterpretations.WhiteIsZero:
    data = rgba.fromWhiteIsZero(raster, max, transparentValue);
    break;
  case PhotometricInterpretations.BlackIsZero:
    data = rgba.fromBlackIsZero(raster, max, transparentValue);
    break;
  case PhotometricInterpretations.RGB:
    data = rgba.fromRGB(raster, transparentValue);
    break;
  case PhotometricInterpretations.Palette:
    if (colorMap) {
      data = rgba.fromPalette(raster, colorMap, transparentValue);
    } else {
      throw new Error('colorMap for paletted image not found.');
    }
    break;
  case PhotometricInterpretations.CMYK:
    data = rgba.fromCMYK(raster, transparentValue);
    break;
  case PhotometricInterpretations.YCbCr:
    data = rgba.fromYCbCr(raster, transparentValue);
    break;
  case PhotometricInterpretations.CIELab:
    data = rgba.fromCIELab(raster, transparentValue);
    break;
  default:
    throw new Error('Unsupported photometric interpretation.');
  }
  return data;
};

export default renderPhoto;
