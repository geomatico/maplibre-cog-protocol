import type { NoDataTest } from '../noData';
import type { TypedArray } from '../types';
export declare function fromWhiteIsZero(data: TypedArray, max: number, isNoData: NoDataTest): Uint8ClampedArray<ArrayBuffer>;
export declare function fromBlackIsZero(data: TypedArray, max: number, isNoData: NoDataTest): Uint8ClampedArray<ArrayBuffer>;
export declare function fromRGB(data: TypedArray, isNoData: NoDataTest): Uint8ClampedArray<ArrayBuffer>;
export declare function fromPalette(data: TypedArray, colorMap: Array<number>, isNoData: NoDataTest): Uint8ClampedArray<ArrayBuffer>;
export declare function fromCMYK(data: TypedArray, isNoData: NoDataTest): Uint8ClampedArray<ArrayBuffer>;
export declare function fromYCbCr(data: TypedArray, isNoData: NoDataTest): Uint8ClampedArray<ArrayBuffer>;
export declare function fromCIELab(data: TypedArray, isNoData: NoDataTest): Uint8ClampedArray<ArrayBuffer>;
