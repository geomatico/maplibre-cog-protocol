import {test, expect, describe} from '@jest/globals';

import {colorScale, colorSchemeNames} from '../src/colorScale';

describe('colorSchemeNames', () => {
  test('is an array containing supported color scale names', () => {
    expect(colorSchemeNames).toBeInstanceOf(Array);
    expect(colorSchemeNames).toHaveLength(291);
    colorSchemeNames.every(name => expect(typeof name).toBe('string'));
    expect(colorSchemeNames).toEqual(expect.not.arrayContaining(['notValid']));
  });
})

describe('colorScale', () => {

  test('throws an error for invalid colorSchemeNames', () => {
    const colorScheme = "notValid";
    const min = 0, max = 1;

    expect(() =>
      colorScale({colorScheme, min, max})
    ).toThrow('"notValid" is not a supported color scheme');
  })

  test('can generate a discrete color interpolator', () => {
    const colorScheme = 'BrewerYlGn3';
    const min = 1;
    const max = 4;

    const color1 = [247, 252, 185];
    const color2 = [173, 221, 142];
    const color3 = [49, 163, 84];

    // Returns a function
    const color = colorScale({colorScheme, min, max});
    expect(typeof color).toBe('function');

    // Min and max values resolve to first and last colors in the scale
    expect(color(min)).toEqual(color1);
    expect(color(max)).toEqual(color3);

    // Values beyond the limits use first and last colors as well
    expect(color(min - 1)).toEqual(color1);
    expect(color(max + 1)).toEqual(color3);

    // Values inside each range match the exact color
    expect(color(1.5)).toEqual(color1);
    expect(color(2.5)).toEqual(color2);
    expect(color(3.5)).toEqual(color3);
  });

  test('can generate discrete color interpolator with reversed colorScheme', () => {
    const colorScheme = 'BrewerYlGn3';
    const min = 1;
    const max = 4;

    const color1 = [247, 252, 185];
    const color2 = [173, 221, 142];
    const color3 = [49, 163, 84];

    // Returns a function
    const color = colorScale({colorScheme, min, max, isReverse: true});
    expect(typeof color).toBe('function');

    // Min and max values resolve to last and first colors in the scale
    expect(color(min)).toEqual(color3);
    expect(color(max)).toEqual(color1);

    // Values beyond the limits use last and first colors as well
    expect(color(min - 1)).toEqual(color3);
    expect(color(max + 1)).toEqual(color1);

    // Values between thresholds match an exact color
    expect(color(1.5)).toEqual(color3);
    expect(color(2.5)).toEqual(color2);
    expect(color(3.5)).toEqual(color1);
  });

  test('can generate a continuous color interpolator', () => {
    const colorScheme = 'BrewerYlGn3';
    const min = 1;
    const max = 3;

    const color1 = [247, 252, 185];
    const color2 = [173, 221, 142];
    const color3 = [49, 163, 84];

    // Returns a function
    const color = colorScale({colorScheme, min, max, isContinuous: true});
    expect(typeof color).toBe('function');

    // Min, max and mid values resolve to exact colors in the scale
    expect(color(min)).toEqual(color1);
    expect(color((min + max) / 2)).toEqual(color2);
    expect(color(max)).toEqual(color3);

    // Values beyond the limits use first or last color
    expect(color(min - 1)).toEqual(color1);
    expect(color(max + 1)).toEqual(color3);

    // Values within an interval are interpolated linearly
    expect(color(1.5)).toEqual(color1.map((c2, i) => (c2 + color2[i]) / 2));
    expect(color(2.5)).toEqual(color2.map((c2, i) => (c2 + color3[i]) / 2));
  });

  test('can generate a continuous color interpolator with reversed colorScheme', () => {
    const colorScheme = 'BrewerYlGn3';
    const min = 1;
    const max = 3;

    const color1 = [247, 252, 185];
    const color2 = [173, 221, 142];
    const color3 = [49, 163, 84];

    // Returns a function
    const color = colorScale({colorScheme, min, max, isContinuous: true, isReverse: true});
    expect(typeof color).toBe('function');

    // Min, max and mid values resolve to exact colors in the scale
    expect(color(min)).toEqual(color3);
    expect(color((min + max) / 2)).toEqual(color2);
    expect(color(max)).toEqual(color1);

    // Values beyond the limits use last or first color
    expect(color(min - 1)).toEqual(color3);
    expect(color(max + 1)).toEqual(color1);

    // Values within an interval are interpolated linearly
    expect(color(1.5)).toEqual(color3.map((c2, i) => (c2 + color2[i]) / 2));
    expect(color(2.5)).toEqual(color2.map((c2, i) => (c2 + color1[i]) / 2));
  });
});
