import * as rgba from './rgba';
export var PhotometricInterpretations;
(function (PhotometricInterpretations) {
    PhotometricInterpretations[PhotometricInterpretations["WhiteIsZero"] = 0] = "WhiteIsZero";
    PhotometricInterpretations[PhotometricInterpretations["BlackIsZero"] = 1] = "BlackIsZero";
    PhotometricInterpretations[PhotometricInterpretations["RGB"] = 2] = "RGB";
    PhotometricInterpretations[PhotometricInterpretations["Palette"] = 3] = "Palette";
    PhotometricInterpretations[PhotometricInterpretations["TransparencyMask"] = 4] = "TransparencyMask";
    PhotometricInterpretations[PhotometricInterpretations["CMYK"] = 5] = "CMYK";
    PhotometricInterpretations[PhotometricInterpretations["YCbCr"] = 6] = "YCbCr";
    PhotometricInterpretations[PhotometricInterpretations["CIELab"] = 8] = "CIELab";
    PhotometricInterpretations[PhotometricInterpretations["ICCLab"] = 9] = "ICCLab";
})(PhotometricInterpretations || (PhotometricInterpretations = {}));
export const renderPhoto = (raster, { noData, photometricInterpretation, bitsPerSample, colorMap }) => {
    const max = bitsPerSample && bitsPerSample[0] ? 2 ** bitsPerSample[0] : NaN;
    const transparentValue = noData ?? 0; // TODO defaulting to 0 may render some good black pixels transparent.
    let data;
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
            }
            else {
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
