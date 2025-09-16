import { CogMetadata, ImageRenderer } from '../types';
export declare enum PhotometricInterpretations {
    WhiteIsZero = 0,
    BlackIsZero = 1,
    RGB = 2,
    Palette = 3,
    TransparencyMask = 4,
    CMYK = 5,
    YCbCr = 6,
    CIELab = 8,
    ICCLab = 9
}
type Options = CogMetadata;
export declare const renderPhoto: ImageRenderer<Options>;
export default renderPhoto;
