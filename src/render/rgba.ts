import {TypedArray} from '../types';

export function fromWhiteIsZero(data: TypedArray[], max: number, transparentValue: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(data[0].length * 4);
  let value;
  for (let i = 0; i < data[0].length; i++) {
    value = 255 - (data[0][i] / max * 255);
    rgba[i * 4] = value;
    rgba[i * 4 + 1] = value;
    rgba[i * 4 + 2] = value;
    rgba[i * 4 + 3] = data[0][i] === transparentValue ? 0 : 255;
  }
  return rgba;
}

export function fromBlackIsZero(data: TypedArray[], max: number, transparentValue: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(data[0].length * 4);
  let value;
  for (let i = 0; i < data[0].length; i++) {
    value = data[0][i] / max * 255;
    rgba[i * 4] = value;
    rgba[i * 4 + 1] = value;
    rgba[i * 4 + 2] = value;
    rgba[i * 4 + 3] = data[0][i] === transparentValue ? 0 : 255;
  }
  return rgba;
}

export function fromRGB(data: TypedArray[], transparentValue: number): Uint8ClampedArray {
  const [R, G, B] = data;
  const rgba = new Uint8ClampedArray(data[0].length * 4);
  for (let i = 0; i < data[0].length; i++) {
    rgba[i * 4] = R[i];
    rgba[i * 4 + 1] = G[i];
    rgba[i * 4 + 2] = B[i];
    rgba[i * 4 + 3] = R[i] === transparentValue && G[i] == transparentValue && B[i] == transparentValue ? 0 : 255;
  }
  return rgba;
}

export function fromPalette(data: TypedArray[], colorMap: Array<number>, transparentValue: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(data[0].length * 4);
  const greenOffset = colorMap.length / 3;
  const blueOffset = colorMap.length / 3 * 2;
  for (let i = 0; i < data[0].length; i++) {
    const mapIndex = data[0][i];
    rgba[i * 4] = colorMap[mapIndex] / 65536 * 256;
    rgba[i * 4 + 1] = colorMap[mapIndex + greenOffset] / 65536 * 256;
    rgba[i * 4 + 2] = colorMap[mapIndex + blueOffset] / 65536 * 256;
    rgba[i * 4 + 3] = data[0][i] === transparentValue ? 0 : 255;
  }
  return rgba;
}

export function fromCMYK(data: TypedArray[], transparentValue: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(data[0].length * 4);
  const [C, M, Y, K] = data;
  for (let i = 0; i < data.length; i++) {
    const c = C[i];
    const m = M[i];
    const y = Y[i];
    const k = K[i];

    rgba[i * 4] = 255 * ((255 - c) / 256) * ((255 - k) / 256);
    rgba[i * 4 + 1] = 255 * ((255 - m) / 256) * ((255 - k) / 256);
    rgba[i * 4 + 2] = 255 * ((255 - y) / 256) * ((255 - k) / 256);
    rgba[i * 4 + 3] = c === transparentValue && m === transparentValue && y === transparentValue && k === transparentValue? 0 : 255;
  }
  return rgba;
}

export function fromYCbCr(data: TypedArray[], transparentValue: number): Uint8ClampedArray {
  const [Y, CB, CR] = data;
  const rgba = new Uint8ClampedArray(data[0].length * 4);
  for (let i = 0; i < data[0].length; i++) {
    const y = Y[i];
    const cb = CB[i];
    const cr = CR[i];

    rgba[i * 4] = (y + (1.40200 * (cr - 0x80)));
    rgba[i * 4 + 1] = (y - (0.34414 * (cb - 0x80)) - (0.71414 * (cr - 0x80)));
    rgba[i * 4 + 2] = (y + (1.77200 * (cb - 0x80)));
    rgba[i * 4 + 3] = y === transparentValue && cb == transparentValue && cr == transparentValue ? 0 : 255;
  }
  return rgba;
}

const Xn = 0.95047;
const Yn = 1.00000;
const Zn = 1.08883;

// from https://github.com/antimatter15/rgb-lab/blob/master/color.js

export function fromCIELab(data: TypedArray[], transparentValue: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(data[0].length);

  for (let i = 0; i < data.length; i++) {
    const L = data[0][i];
    const a_ = data[1][i] << 24 >> 24; // conversion from uint8 to int8
    const b_ = data[2][i] << 24 >> 24; // same

    let y = (L + 16) / 116;
    let x = (a_ / 500) + y;
    let z = y - (b_ / 200);
    let r;
    let g;
    let b;

    x = Xn * ((x * x * x > 0.008856) ? x * x * x : (x - (16 / 116)) / 7.787);
    y = Yn * ((y * y * y > 0.008856) ? y * y * y : (y - (16 / 116)) / 7.787);
    z = Zn * ((z * z * z > 0.008856) ? z * z * z : (z - (16 / 116)) / 7.787);

    r = (x * 3.2406) + (y * -1.5372) + (z * -0.4986);
    g = (x * -0.9689) + (y * 1.8758) + (z * 0.0415);
    b = (x * 0.0557) + (y * -0.2040) + (z * 1.0570);

    r = (r > 0.0031308) ? ((1.055 * (r ** (1 / 2.4))) - 0.055) : 12.92 * r;
    g = (g > 0.0031308) ? ((1.055 * (g ** (1 / 2.4))) - 0.055) : 12.92 * g;
    b = (b > 0.0031308) ? ((1.055 * (b ** (1 / 2.4))) - 0.055) : 12.92 * b;

    rgba[4 * i] = Math.max(0, Math.min(1, r)) * 255;
    rgba[4 * i + 1] = Math.max(0, Math.min(1, g)) * 255;
    rgba[4 * i + 2] = Math.max(0, Math.min(1, b)) * 255;
    rgba[i * 4 + 3] = L === transparentValue && a_ == transparentValue && b_ == transparentValue ? 0 : 255;
  }
  return rgba;
}
