import { TypedArray } from 'geotiff';
import { PixelValue, RGBAValue } from '../types';

export function fromWhiteIsZero([px]: PixelValue, color: RGBAValue, max: number, transparentValue: number): void {
  const value = 255 - (px / max) * 255;

  color.set([value, value, value, px === transparentValue ? 0 : 255]);
}

export function fromBlackIsZero([px]: PixelValue, color: RGBAValue, max: number, transparentValue: number): void {
  const value = (px / max) * 255;

  color.set([value, value, value, px === transparentValue ? 0 : 255]);
}

export function fromRGB(data: TypedArray[], pixelIndex: number, color: RGBAValue, transparentValue: number): void {
  const [R, G, B] = data;

  color.set(
    [
      R[pixelIndex],
      G[pixelIndex],
      B[pixelIndex],
      R[pixelIndex] === transparentValue && G[pixelIndex] == transparentValue && B[pixelIndex] == transparentValue ? 0 : 255,
    ],
    pixelIndex * 4
  );
}

export function fromPalette([mapIndex]: PixelValue, color: RGBAValue, colorMap: Array<number>, transparentValue: number): void {
  const greenOffset = colorMap.length / 3;
  const blueOffset = (colorMap.length / 3) * 2;

  color.set([
    (colorMap[mapIndex] / 65536) * 256,
    (colorMap[mapIndex + greenOffset] / 65536) * 256,
    (colorMap[mapIndex + blueOffset] / 65536) * 256,
    mapIndex === transparentValue ? 0 : 255,
  ]);
}

export function fromCMYK(data: TypedArray[], pixelIndex: number, color: RGBAValue, transparentValue: number): void {
  const [C, M, Y, K] = data;

  const c = C[pixelIndex];
  const m = M[pixelIndex];
  const y = Y[pixelIndex];
  const k = K[pixelIndex];

  color.set([
    255 * ((255 - c) / 256) * ((255 - k) / 256),
    255 * ((255 - m) / 256) * ((255 - k) / 256),
    255 * ((255 - y) / 256) * ((255 - k) / 256),
    c === transparentValue && m === transparentValue && y === transparentValue && k === transparentValue ? 0 : 255,
  ]);
}

export function fromYCbCr(data: TypedArray[], pixelIndex: number, color: RGBAValue, transparentValue: number): void {
  const [Y, CB, CR] = data;

  const y = Y[pixelIndex];
  const cb = CB[pixelIndex];
  const cr = CR[pixelIndex];

  color.set([
    y + 1.402 * (cr - 0x80),
    y - 0.34414 * (cb - 0x80) - 0.71414 * (cr - 0x80),
    y + 1.772 * (cb - 0x80),
    y === transparentValue && cb == transparentValue && cr == transparentValue ? 0 : 255,
  ]);
}

const Xn = 0.95047;
const Yn = 1.0;
const Zn = 1.08883;

// from https://github.com/antimatter15/rgb-lab/blob/master/color.js

export function fromCIELab(data: TypedArray[], pixelIndex: number, color: RGBAValue, transparentValue: number): void {
  const L = data[0][pixelIndex];
  const a_ = (data[1][pixelIndex] << 24) >> 24; // conversion from uint8 to int8
  const b_ = (data[2][pixelIndex] << 24) >> 24; // same

  let y = (L + 16) / 116;
  let x = a_ / 500 + y;
  let z = y - b_ / 200;
  let r;
  let g;
  let b;

  x = Xn * (x * x * x > 0.008856 ? x * x * x : (x - 16 / 116) / 7.787);
  y = Yn * (y * y * y > 0.008856 ? y * y * y : (y - 16 / 116) / 7.787);
  z = Zn * (z * z * z > 0.008856 ? z * z * z : (z - 16 / 116) / 7.787);

  r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  b = x * 0.0557 + y * -0.204 + z * 1.057;

  r = r > 0.0031308 ? 1.055 * r ** (1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * g ** (1 / 2.4) - 0.055 : 12.92 * g;
  b = b > 0.0031308 ? 1.055 * b ** (1 / 2.4) - 0.055 : 12.92 * b;

  color.set([
    Math.max(0, Math.min(1, r)) * 255,
    Math.max(0, Math.min(1, g)) * 255,
    Math.max(0, Math.min(1, b)) * 255,
    L === transparentValue && a_ == transparentValue && b_ == transparentValue ? 0 : 255,
  ]);
}
