import { TypedArray } from 'geotiff';
import { ColorFunction, ImageRenderer, RendererMetadata } from '../types';
import { colorTile } from './colorTile';
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

type Options = RendererMetadata;

export const renderPhoto: ImageRenderer<Options> = (data: TypedArray[], options: Options): Uint8ClampedArray => {
  const { noData, photometricInterpretation, bitsPerSample, colorMap } = options;

  const max = bitsPerSample && bitsPerSample[0] ? 2 ** bitsPerSample[0] : NaN;
  const transparentValue = noData ?? 0; // TODO defaulting to 0 may render some good black pixels transparent.

  let color: Uint8ClampedArray = new Uint8ClampedArray(data[0].length * 4);
  let colorFunction: ColorFunction;

  switch (photometricInterpretation) {
    case PhotometricInterpretations.WhiteIsZero:
      colorFunction = (px, color) => rgba.fromWhiteIsZero(px, color, max, transparentValue);
      break;

    case PhotometricInterpretations.BlackIsZero:
      colorFunction = (px, color) => rgba.fromBlackIsZero(px, color, max, transparentValue);
      break;

    case PhotometricInterpretations.RGB: {
      colorFunction = (_px, color, _options, pixelIndex) => rgba.fromRGB(data, pixelIndex!, color, transparentValue);
      break;
    }

    case PhotometricInterpretations.Palette:
      if (colorMap) {
        colorFunction = (px, color) => rgba.fromPalette(px, color, colorMap, transparentValue);
      } else {
        throw new Error('colorMap for paletted image not found.');
      }
      break;

    case PhotometricInterpretations.CMYK:
      colorFunction = (_px, color, _options, pixelIndex) => rgba.fromCMYK(data, pixelIndex!, color, transparentValue);
      break;

    case PhotometricInterpretations.YCbCr:
      colorFunction = (_px, color, _options, pixelIndex) => rgba.fromYCbCr(data, pixelIndex!, color, transparentValue);
      break;

    case PhotometricInterpretations.CIELab: {
      color = new Uint8ClampedArray(data[0].length);

      colorFunction = (_px, color, _options, pixelIndex) => rgba.fromCIELab(data, pixelIndex!, color, transparentValue);
      break;
    }

    default:
      throw new Error('Unsupported photometric interpretation.');
  }
  return colorTile(data, options, colorFunction, color);
};

export default renderPhoto;
