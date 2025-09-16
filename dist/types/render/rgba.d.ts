import { TypedArray } from '../types';
export declare function fromWhiteIsZero(data: TypedArray, max: number, transparentValue: number): Uint8ClampedArray<ArrayBuffer>;
export declare function fromBlackIsZero(data: TypedArray, max: number, transparentValue: number): Uint8ClampedArray<ArrayBuffer>;
export declare function fromRGB(data: TypedArray, transparentValue: number): Uint8ClampedArray<ArrayBuffer>;
export declare function fromPalette(data: TypedArray, colorMap: Array<number>, transparentValue: number): Uint8ClampedArray<ArrayBuffer>;
export declare function fromCMYK(data: TypedArray, transparentValue: number): Uint8ClampedArray<ArrayBuffer>;
export declare function fromYCbCr(data: TypedArray, transparentValue: number): Uint8ClampedArray<ArrayBuffer>;
export declare function fromCIELab(data: TypedArray, transparentValue: number): Uint8ClampedArray<ArrayBuffer>;
