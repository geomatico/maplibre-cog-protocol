import {globals, rgb, ReadRasterResult} from 'geotiff';

const {photometricInterpretations, ExtraSamplesValues} = globals;

type FileDirectory = {
  PhotometricInterpretation: number;
  ColorMap: Array<number>;
  ExtraSamples: number;
  BitsPerSample: Array<number>;
}

export const computeSamples = (fileDirectory: FileDirectory, enableAlpha = false) => {
  const pi = fileDirectory.PhotometricInterpretation;

  let samples;
  switch (pi) {
  case photometricInterpretations.WhiteIsZero:
  case photometricInterpretations.BlackIsZero:
  case photometricInterpretations.Palette:
    samples = [0];
    break;
  case photometricInterpretations.RGB:
  case photometricInterpretations.YCbCr:
  case photometricInterpretations.CIELab:
    samples = [0, 1, 2];
    break;
  case photometricInterpretations.CMYK:
    samples = [0, 1, 2, 3];
    break;
  default:
    throw new Error('Invalid or unsupported photometric interpretation.');
  }

  if (pi === photometricInterpretations.RGB && enableAlpha && !(fileDirectory.ExtraSamples === ExtraSamplesValues.Unspecified)) {
    samples = [...Array(fileDirectory.BitsPerSample.length).keys()]; // Meaning all bands, really
  }

  return samples;
};

export const toRGB = (raster: ReadRasterResult, fileDirectory: FileDirectory): Uint8Array | Uint8ClampedArray => {
  const pi = fileDirectory.PhotometricInterpretation;
  const max = 2 ** fileDirectory.BitsPerSample[0];

  let data;
  switch (pi) {
  case photometricInterpretations.RGB:
    data = raster as Uint8Array;
    break;
  case photometricInterpretations.WhiteIsZero:
    data = rgb.fromWhiteIsZero(raster, max);
    break;
  case photometricInterpretations.BlackIsZero:
    data = rgb.fromBlackIsZero(raster, max);
    break;
  case photometricInterpretations.Palette:
    data = rgb.fromPalette(raster, fileDirectory.ColorMap);
    break;
  case photometricInterpretations.CMYK:
    data = rgb.fromCMYK(raster);
    break;
  case photometricInterpretations.YCbCr:
    data = rgb.fromYCbCr(raster);
    break;
  case photometricInterpretations.CIELab:
    data = rgb.fromCIELab(raster);
    break;
  default:
    throw new Error('Unsupported photometric interpretation.');
  }
  return data;
};
