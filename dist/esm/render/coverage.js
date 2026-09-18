import { TILE_SIZE } from '../constants';
const clearAlpha = (rgba, row, fromColumn, toColumn) => {
    for (let col = fromColumn; col < toColumn; col++) {
        rgba[(row * TILE_SIZE + col) * 4 + 3] = 0;
    }
};
/**
 * Makes transparent the tile pixels that lie outside the COG: those have no source pixel at all,
 * just the fillValue the reader asked geotiff.js for, which for integer rasters is a value like
 * any other. Coverage is geometry, so it applies whatever the COG declares as noData.
 */
export const applyCoverage = (rgba, { left, top, right, bottom }) => {
    if (left <= 0 && top <= 0 && right >= TILE_SIZE && bottom >= TILE_SIZE)
        return; // fully covered
    for (let row = 0; row < TILE_SIZE; row++) {
        if (row < top || row >= bottom) {
            clearAlpha(rgba, row, 0, TILE_SIZE);
        }
        else {
            clearAlpha(rgba, row, 0, left);
            clearAlpha(rgba, row, right, TILE_SIZE);
        }
    }
};
