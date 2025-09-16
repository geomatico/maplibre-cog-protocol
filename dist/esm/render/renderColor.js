import { colorScale } from './colorScale';
import { TILE_SIZE } from '../constants';
const renderColor = (data, { offset, scale, noData, colorScale: colorScaleParams }) => {
    const pixels = TILE_SIZE * TILE_SIZE;
    const numBands = data.length / pixels;
    const rgba = new Uint8ClampedArray(pixels * 4);
    const interpolate = colorScale(colorScaleParams);
    for (let i = 0; i < pixels; i++) {
        const px = offset + data[i * numBands] * scale;
        if (px === noData || isNaN(px) || px === Infinity) {
            rgba[4 * i] = 0;
            rgba[4 * i + 1] = 0;
            rgba[4 * i + 2] = 0;
            rgba[4 * i + 3] = 0;
        }
        else {
            const color = interpolate(px);
            rgba[4 * i] = color[0];
            rgba[4 * i + 1] = color[1];
            rgba[4 * i + 2] = color[2];
            rgba[4 * i + 3] = 255;
        }
    }
    return rgba;
};
export default renderColor;
