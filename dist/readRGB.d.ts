import { ReadRasterResult } from 'geotiff';
type FileDirectory = {
    PhotometricInterpretation: number;
    ColorMap: Array<number>;
    ExtraSamples: number;
    BitsPerSample: Array<number>;
};
export declare const computeSamples: (fileDirectory: FileDirectory, enableAlpha?: boolean) => number[];
export declare const toRGB: (raster: ReadRasterResult, fileDirectory: FileDirectory) => Uint8Array | Uint8ClampedArray;
export {};
