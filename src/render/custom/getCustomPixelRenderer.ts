import {CogMetadata, ImageRenderer, PixelToColorFunction} from '../../types';

const getCustomPixelRenderer = (toColor: PixelToColorFunction): ImageRenderer<CogMetadata> =>
  (data, metadata) => {
    const {offset, scale} = metadata;
    const pixels = data[0].length;
    const rgba = new Uint8ClampedArray(pixels * 4);

    for (let i = 0; i < pixels; i++) {
      const px = data.map(band => offset + band[i] * scale);
      toColor(px, rgba.subarray(4 * i, 4 * i + 4), metadata);
    }
    return rgba;
  }

export default getCustomPixelRenderer;
