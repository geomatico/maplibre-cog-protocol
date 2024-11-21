import {test, expect} from '@jest/globals';

import {cogProtocol, colorScale, colorSchemeNames, setColorFunction, locationValues} from '../src/index';

describe('index', () => {
  test('exports public API', () => {
    expect(cogProtocol).toBeDefined();
    expect(colorScale).toBeDefined();
    expect(colorSchemeNames).toBeDefined();
    expect(setColorFunction).toBeDefined();
    expect(locationValues).toBeDefined();
  })
});
