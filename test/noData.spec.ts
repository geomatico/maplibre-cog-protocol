import {test, expect} from 'vitest';

import {noDataTest, parseNoData} from '../src/noData';

describe('noDataTest', () => {

  test('nothing is noData when the COG declares no value', () => {
    const isNoData = noDataTest(undefined, new Uint8Array([0, 1, 255]));

    expect(isNoData(0)).toBe(false);
    expect(isNoData(255)).toBe(false);
  });

  test('matches the declared value', () => {
    const isNoData = noDataTest(0, new Uint8Array([0, 1]));

    expect(isNoData(0)).toBe(true);
    expect(isNoData(1)).toBe(false);
  });

  test('a NaN noData matches NaN samples, which === never does', () => {
    const isNoData = noDataTest(NaN, new Float32Array([NaN, 1.5]));

    expect(isNoData(NaN)).toBe(true);
    expect(isNoData(1.5)).toBe(false);
  });

  test('a Float32 noData is compared with the precision the samples have', () => {
    const data = new Float32Array([-9999.1]);
    const isNoData = noDataTest(-9999.1, data);

    expect(data[0]).not.toBe(-9999.1); // the array holds -9999.099609375
    expect(isNoData(data[0])).toBe(true);
  });

  test('a Float64 noData is compared as is', () => {
    const isNoData = noDataTest(-9999.1, new Float64Array([-9999.1]));

    expect(isNoData(-9999.1)).toBe(true);
  });

  test('a value the raster type cannot hold never matches', () => {
    const isNoData = noDataTest(-9999, new Uint8Array([0, 241, 255]));

    expect(isNoData(241)).toBe(false); // -9999 wrapped into a byte, but not the noData value
    expect(isNoData(0)).toBe(false);
  });

  test('infinite noData values match', () => {
    const isNoData = noDataTest(-Infinity, new Float32Array([-Infinity, 0]));

    expect(isNoData(-Infinity)).toBe(true);
    expect(isNoData(0)).toBe(false);
  });

});

describe('parseNoData', () => {

  test('parses the numbers GDAL writes', () => {
    expect(parseNoData('0')).toBe(0);
    expect(parseNoData('-9999')).toBe(-9999);
    expect(parseNoData('-3.4028234663852886e+38')).toBe(-3.4028234663852886e38);
  });

  test('parses the non-finite values GDAL writes', () => {
    expect(parseNoData('nan')).toBeNaN();
    expect(parseNoData('inf')).toBe(Infinity);
    expect(parseNoData('-inf')).toBe(-Infinity);
    expect(parseNoData('Infinity')).toBe(Infinity);
  });

  test('ignores the trailing NUL of the ASCII tag', () => {
    expect(parseNoData('0\0')).toBe(0);
    expect(parseNoData('-inf\0')).toBe(-Infinity);
  });

  test('returns undefined for an absent or unparsable tag', () => {
    expect(parseNoData(undefined)).toBeUndefined();
    expect(parseNoData('not a number')).toBeUndefined();
  });

});
