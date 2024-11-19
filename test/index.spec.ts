import {test, expect} from '@jest/globals';

import {cogProtocol, colorScale, colorSchemeNames, setCustomColor, locationValues} from '../src/index';

describe('index', () => {
  test('exports cogProtocol, colorScale and colorSchemeNames', () => {
    expect(cogProtocol).toBeDefined();
    expect(colorScale).toBeDefined();
    expect(colorSchemeNames).toBeDefined();
    expect(locationValues).toBeDefined();
    expect(setCustomColor).toBeDefined();
  })
});
