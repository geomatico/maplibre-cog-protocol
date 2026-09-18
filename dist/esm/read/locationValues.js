import { TILE_SIZE } from '../constants';
import { noDataTest } from '../noData';
import { isMaskedOut } from '../render/mask';
import CogReader from './CogReader';
import { tilePixelFromLatLonZoom } from './math';
const locationValues = async (url, { latitude, longitude }, zoom) => {
    const cog = CogReader(url);
    const { minzoom, maxzoom } = await cog.getTilejson(url);
    const { noData, scale, offset, alphaBand } = await cog.getMetadata();
    const normalizedZoom = zoom === undefined ? maxzoom : Math.max(minzoom, Math.min(maxzoom, Math.round(zoom)));
    const { tileIndex, column, row } = tilePixelFromLatLonZoom({ latitude, longitude, zoom: normalizedZoom });
    const tile = await cog.getRawTile(tileIndex);
    const pixels = TILE_SIZE * TILE_SIZE;
    const numBands = tile.length / pixels;
    const nothing = () => new Array(numBands).fill(NaN);
    const { left, top, right, bottom } = await cog.getTileCoverage(tileIndex);
    if (column < left || column >= right || row < top || row >= bottom) {
        return nothing(); // outside the image: no data was read, just a fill value
    }
    if (isMaskedOut([longitude, latitude], tileIndex)) {
        return nothing(); // hidden by the user mask, so not rendered either
    }
    const i = row * TILE_SIZE + column;
    // Same precedence as when rendering: mask band, then noData, then alpha sample.
    const rawMask = await cog.getRawTile(tileIndex, { mask: true });
    if (rawMask) {
        if (rawMask[i] === 0)
            return nothing();
    }
    else if (noData === undefined && alphaBand !== undefined) {
        if (tile[i * numBands + alphaBand] === 0)
            return nothing();
    }
    const isNoData = noDataTest(rawMask ? undefined : noData, tile);
    return Array.from(tile.subarray(i * numBands, i * numBands + numBands)).map((rawValue) => {
        const px = offset + rawValue * scale;
        return isNoData(rawValue) || !Number.isFinite(px) ? NaN : px;
    });
};
export default locationValues;
