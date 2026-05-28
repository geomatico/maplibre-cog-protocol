import {test, expect} from 'vitest';

import {cogProtocol, colorScale, colorSchemeNames, setColorFunction, setMask, clearMask, locationValues} from '../src/index';

describe('index', () => {
  test('exports public API', () => {
    expect(cogProtocol).toBeDefined();
    expect(colorScale).toBeDefined();
    expect(colorSchemeNames).toBeDefined();
    expect(setColorFunction).toBeDefined();
    expect(setMask).toBeDefined();
    expect(clearMask).toBeDefined();
    expect(locationValues).toBeDefined();
  })
});
