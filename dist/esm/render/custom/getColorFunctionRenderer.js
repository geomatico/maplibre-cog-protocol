import { TILE_SIZE } from '../../constants';
const getColorFunctionRenderer = (colorFunction) => (data, metadata) => {
    const pixels = TILE_SIZE * TILE_SIZE;
    const numBands = data.length / pixels;
    const rgba = new Uint8ClampedArray(pixels * 4);
    for (let i = 0; i < pixels; i++) {
        colorFunction(data.subarray(i * numBands, i * numBands + numBands), // pixel
        rgba.subarray(4 * i, 4 * i + 4), // color
        metadata);
    }
    return rgba;
};
export default getColorFunctionRenderer;
