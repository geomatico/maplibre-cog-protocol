# Migrations

## [0.9.x] to [0.10.0]

### Transparency now follows GDAL semantics

Several changes to when a pixel is rendered transparent, all of them aligning this library with
GDAL. Only the first one can make a COG that looked right look worse.

#### A COG declaring no `noData` value no longer has transparent pixels

Previously, a COG with no `noData` value fell back to treating 0 as transparent, which also erased
genuinely black pixels, and the first entry of a color table. Now, as in GDAL, rasterio, QGIS and
OpenLayers, an undeclared `noData` means every pixel is valid.

Check what a COG actually declares with:

```bash
gdalinfo <target>.tif | grep -E 'NoData|Mask Flags'
```

Note that COGs built with the `gdalwarp ... -of COG -co TILING_SCHEME=... -dstnodata ...` recipe
this README used to recommend have **no** `NoData Value`: when `TILING_SCHEME` makes the COG driver
reproject, `gdalwarp` does not carry `-dstnodata` into the output file. Those files are the ones
most likely to change appearance.

The best fix for lossy imagery is to regenerate the COG from its source letting GDAL write a mask
band, which is exact where `noData` matching is not (see the
[GDAL commands](README.md#cog-generation-tips)):

```bash
gdalwarp <source>.tif <target>.tif -of COG -co COMPRESS=JPEG -co TILING_SCHEME=GoogleMapsCompatible
```

To add a `noData` value to a COG you cannot regenerate, write a new file rather than editing it in
place: `gdal_edit.py` rewrites the IFD at the end of the file and the result is no longer a valid
COG (`KNOWN_INCOMPATIBLE_EDITION=YES`). This keeps the COG layout, at the cost of re-encoding the
imagery:

```bash
gdal_translate <target>.tif <fixed>.tif -of COG -a_nodata 0 -co COMPRESS=DEFLATE
```

Unaffected: COGs that declare a `noData` value, COGs with an internal mask band, `#dem` and
`#color` rendering, and custom color functions, which never had this fallback.

#### An internal mask band now takes precedence over `noData`

When a COG carries both, only the mask decides which pixels are transparent, which is GDAL's own
precedence (RFC 15). Before, both were applied, so a valid black pixel inside a masked JPEG image
could disappear.

#### An alpha sample is now read as transparency

A COG with an alpha band declared in the TIFF `ExtraSamples` tag (what `gdalwarp -dstalpha` and the
COG driver's `ADD_ALPHA=YES` write) previously rendered fully opaque, the alpha band being ignored.
It is now applied, after the mask band and `noData` in the precedence chain. A file whose collar
was drawn as opaque black turns transparent.

#### `locationValues` returns NaN wherever nothing is drawn

Besides the cases it already covered (outside the image, `noData`), it now also returns `NaN` for
every band where the COG's mask band or alpha sample marks the pixel as transparent, and for
locations outside the GeoJSON mask set with `setMask`.

#### `noData` is compared against the raw, decoded value

`noData` is now matched before `scale` and `offset` are applied, as GDAL defines it, and for JPEG
COGs stored as YCbCr against the decoded RGB values rather than the raw Y/Cb/Cr bytes (which never
matched, [#52](https://github.com/geomatico/maplibre-cog-protocol/issues/52)). If your COG declares
`SCALE` or `OFFSET` and you were compensating for the old behaviour by declaring a scaled `noData`,
restore the file's real value.

Custom color functions are unaffected: `pixel` still holds raw values and `metadata.noData` the
value declared in the file.

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
