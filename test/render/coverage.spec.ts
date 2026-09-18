import {test, expect} from 'vitest';

import {applyCoverage} from '../../src/render/coverage';

const opaqueTile = () => new Uint8ClampedArray(4 * 256 * 256).fill(255);

const alpha = (rgba: Uint8ClampedArray, column: number, row: number) => rgba[(row * 256 + column) * 4 + 3];

describe('applyCoverage', () => {

  test('leaves a fully covered tile untouched', () => {
    const rgba = opaqueTile();

    applyCoverage(rgba, {left: 0, top: 0, right: 256, bottom: 256});

    expect(rgba.every(value => value === 255)).toBe(true);
  });

  test('makes transparent the pixels outside the covered rectangle', () => {
    const rgba = opaqueTile();

    applyCoverage(rgba, {left: 10, top: 20, right: 200, bottom: 100});

    expect(alpha(rgba, 10, 20)).toBe(255);       // first covered pixel
    expect(alpha(rgba, 199, 99)).toBe(255);      // last covered pixel
    expect(alpha(rgba, 9, 20)).toBe(0);          // one column to the left
    expect(alpha(rgba, 200, 99)).toBe(0);        // one column to the right
    expect(alpha(rgba, 10, 19)).toBe(0);         // one row above
    expect(alpha(rgba, 10, 100)).toBe(0);        // one row below
    expect(alpha(rgba, 0, 0)).toBe(0);
    expect(alpha(rgba, 255, 255)).toBe(0);
  });

  test('keeps the colour channels of uncovered pixels, only clearing alpha', () => {
    const rgba = opaqueTile();

    applyCoverage(rgba, {left: 128, top: 0, right: 256, bottom: 256});

    expect(Array.from(rgba.subarray(0, 4))).toEqual([255, 255, 255, 0]);
  });

  test('makes the whole tile transparent when nothing is covered', () => {
    const rgba = opaqueTile();

    applyCoverage(rgba, {left: 0, top: 0, right: 0, bottom: 0});

    expect(rgba.filter((_, i) => i % 4 === 3).every(value => value === 0)).toBe(true);
  });

});
