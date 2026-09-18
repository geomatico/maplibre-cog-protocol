import { TILE_SIZE } from '../constants';
import { noDataTest } from '../noData';
import { colorScale } from './colorScale';
const renderColor = (data, { offset, scale, noData, colorScale: colorScaleParams }) => {
    const pixels = TILE_SIZE * TILE_SIZE;
    const numBands = data.length / pixels;
    const rgba = new Uint8ClampedArray(pixels * 4);
    const interpolate = colorScale(colorScaleParams);
    const isNoData = noDataTest(noData, data);
    for (let i = 0; i < pixels; i++) {
        const raw = data[i * numBands];
        const px = offset + raw * scale;
        // A value that is not finite cannot be placed on a color ramp, whatever the COG declares.
        if (isNoData(raw) || !Number.isFinite(px)) {
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
