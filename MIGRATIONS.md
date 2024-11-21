# Migrations

## [0.3.2] to [0.4.0]

### Deprecated setting custom color ramp as URL hash

The ability to provide a custom array of colors as URL hash `#color:["#ffeda0","#feb24c","#f03b20"]` has been DEPRECATED and will be removed in future versions.

For example, `#color:["#ffeda0","#feb24c","#f03b20"],1.7,1.8` can be implemented using `setColorFunction` and a d3 interpolator:

```javascript
import {setColorFunction} from '@geomatico/maplibre-cog-protocol';
import {scaleThreshold} from 'd3-scale';

// Color ramp specification
const [min, max] = [1.7, 1.8];
const colors = [[0xFF, 0xED, 0xA0, 0xFF], [0xFE, 0xB2, 0x4C, 0xFF], [0xF0, 0x3B, 0x20, 0xFF]];

// Build a d3 threshold interpolator
const d = max - min;
const n = colors.length;
const thresholds = [min + (d * 1 / n), min + (d * 2 / n)];
const interpolate = scaleThreshold(thresholds, colors);

setColorFunction('example.tif', ([value], rgba, {noData}) => {
  if (value === noData || value === Infinity || isNaN(value)) {
    rgba.set([0, 0, 0, 0]); // noData, fillValue or NaN => transparent
  } else {
    rgba.set(interpolate(value));
  }
});
```
