import SphericalMercator from '@mapbox/sphericalmercator';
const TILE_SIZE = 256;
const MAX_EXTENT = 2 * 20037508.342789244;
const merc = new SphericalMercator({
    size: TILE_SIZE,
    antimeridian: true
});
export const tileIndexToMercatorBbox = ({ x, y, z }) => merc.bbox(x, y, z, false, '900913');
export const mercatorBboxToGeographicBbox = ([xMin, yMin, xMax, yMax]) => ([...merc.inverse([xMin, yMin]), ...merc.inverse([xMax, yMax])]);
export const zoomFromResolution = (res) => Math.log2(MAX_EXTENT / (TILE_SIZE * res));
export const tilePixelFromLatLonZoom = ({ latitude, longitude, zoom }) => {
    const [mercatorX, mercatorY] = merc.forward([longitude, latitude]);
    const pixelX = (mercatorX + MAX_EXTENT / 2) / MAX_EXTENT * TILE_SIZE * 2 ** zoom;
    const pixelY = -(mercatorY - MAX_EXTENT / 2) / MAX_EXTENT * TILE_SIZE * 2 ** zoom;
    return {
        tileIndex: {
            z: zoom,
            x: Math.floor(pixelX / TILE_SIZE),
            y: Math.floor(pixelY / TILE_SIZE)
        },
        row: Math.floor(pixelY % TILE_SIZE),
        column: Math.floor(pixelX % TILE_SIZE)
    };
};
