import { SphericalMercator } from '@mapbox/sphericalmercator';
const TILE_SIZE = 256;
const MAX_EXTENT = 2 * 20037508.342789244;
const merc = new SphericalMercator({
    size: TILE_SIZE,
    antimeridian: true,
});
export const tileIndexToMercatorBbox = ({ x, y, z }) => merc.bbox(x, y, z, false, '900913');
export const mercatorBboxToGeographicBbox = ([xMin, yMin, xMax, yMax]) => {
    const [w, s] = merc.inverse([xMin, yMin]);
    const [e, n] = merc.inverse([xMax, yMax]);
    return [w, s, e, n];
};
export const zoomFromResolution = (res) => Math.log2(MAX_EXTENT / (TILE_SIZE * res));
export const tileIndexToPixelWindow = ({ x, y, z }, imageBox, imageWidth, imageHeight) => {
    const [west, south, east, north] = tileIndexToMercatorBbox({ x, y, z });
    const scaleX = imageWidth / (imageBox[2] - imageBox[0]);
    const scaleY = imageHeight / (imageBox[3] - imageBox[1]);
    return [
        Math.round((west - imageBox[0]) * scaleX),
        Math.round((imageBox[3] - north) * scaleY),
        Math.round((east - imageBox[0]) * scaleX),
        Math.round((imageBox[3] - south) * scaleY),
    ];
};
/**
 * Inverse of geotiff.js nearest-neighbour resampling, for one axis: the tile pixel at index i takes
 * its value from the window pixel `windowStart + min(round(i * ratio), span - 1)`. Returns the
 * half-open range of tile indexes whose source pixel falls inside the image, i.e. in [0, imageSize).
 */
const coveredRange = (windowStart, windowEnd, imageSize, tileSize) => {
    const span = windowEnd - windowStart;
    const ratio = span / tileSize;
    const clamp = (value) => Math.min(Math.max(value, 0), tileSize);
    // Tile indexes from this one on all sample the last window pixel, because of that min():
    // round(i * ratio) >= span  ⟺  i >= (span - 0.5) / ratio
    const clampedFrom = clamp(Math.ceil((span - 0.5) / ratio));
    const isLastWindowPixelCovered = windowStart + span - 1 >= 0 && windowStart + span - 1 < imageSize;
    // Before that, the sampled pixel grows with i, so coverage is a single range:
    // round(i * ratio) >= -windowStart              ⟺  i >= (-windowStart - 0.5) / ratio
    // round(i * ratio) <= imageSize - 1 - windowStart  ⟺  i < (imageSize - windowStart - 0.5) / ratio
    const first = clamp(Math.ceil((-windowStart - 0.5) / ratio));
    const last = Math.min(clamp(Math.ceil((imageSize - windowStart - 0.5) / ratio)), clampedFrom);
    if (isLastWindowPixelCovered)
        return [last > first ? first : clampedFrom, tileSize];
    return last > first ? [first, last] : [0, 0]; // no overlap at all: empty coverage
};
/**
 * Which tile pixels are covered by the image, given the pixel window the tile maps to. A window
 * may extend beyond the image when the tile straddles its border: those pixels hold the read
 * fillValue, not data, and are the ones this rectangle leaves out.
 */
export const pixelWindowToTileCoverage = ([left, top, right, bottom], imageWidth, imageHeight, tileSize) => {
    const [x0, x1] = coveredRange(left, right, imageWidth, tileSize);
    const [y0, y1] = coveredRange(top, bottom, imageHeight, tileSize);
    return { left: x0, top: y0, right: x1, bottom: y1 };
};
export const tilePixelFromLatLonZoom = ({ latitude, longitude, zoom }) => {
    const [mercatorX, mercatorY] = merc.forward([longitude, latitude]);
    const pixelX = ((mercatorX + MAX_EXTENT / 2) / MAX_EXTENT) * TILE_SIZE * 2 ** zoom;
    const pixelY = (-(mercatorY - MAX_EXTENT / 2) / MAX_EXTENT) * TILE_SIZE * 2 ** zoom;
    return {
        tileIndex: {
            z: zoom,
            x: Math.floor(pixelX / TILE_SIZE),
            y: Math.floor(pixelY / TILE_SIZE),
        },
        row: Math.floor(pixelY % TILE_SIZE),
        column: Math.floor(pixelX % TILE_SIZE),
    };
};
