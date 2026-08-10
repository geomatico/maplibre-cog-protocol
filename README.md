# MapLibre COG Protocol — Display Cloud Optimized GeoTIFFs in MapLibre GL JS

**MapLibre COG Protocol** is an open source JavaScript library for loading and visualizing
[Cloud Optimized GeoTIFFs](https://cogeo.org/) directly in [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/).

It adds a custom `cog://` protocol that lets MapLibre applications display large raster datasets
straight from cloud storage using HTTP range requests, without a traditional raster tile server in
between. Only the parts of the file needed by the current map view are fetched and decoded, in the
browser, using [geotiff.js](https://geotiffjs.github.io/).

The library renders RGB and grayscale imagery, digital elevation models, 3D terrain and hillshading,
and applies color ramps to single-band rasters. It also lets you write your own per-pixel coloring
functions, so the bands of a multispectral satellite image can be combined in the browser to derive
indicators such as NDVI on the fly, with no preprocessing and no derived files to store.


## Why use MapLibre COG Protocol?

Traditional web raster architectures require preprocessing your data into tiles and running a
dedicated tile server to publish them. Cloud Optimized GeoTIFFs remove that step: the file itself is
organized so a client can request just the byte ranges it needs. This library brings that serverless
raster workflow to MapLibre GL JS, which helps you:

* Publish large rasters from plain object storage (S3, GCS, Azure Blob, or any HTTP server supporting range requests).
* Cut raster infrastructure, preprocessing and hosting costs.
* Display multi-gigabyte GeoTIFFs in the browser without downloading them whole.
* Visualize satellite imagery, elevation models and other scientific rasters.
* Apply color ramps and band arithmetic client-side, with no server round trip.
* Derive indices from multispectral imagery on the fly, instead of precomputing and storing a raster per index.
* Change the formula, thresholds or palette of an indicator without regenerating any data.
* Keep control of your stack with open source geospatial software.


## Main features

* Direct COG visualization in MapLibre GL JS, via a `cog://` URL prefix.
* Imagery rendering driven by the COG's own `PhotometricInterpretation`: RGB, grayscale, paletted, CMYK, YCbCr and CIELab.
* Digital elevation model visualization, as hillshading or 3D terrain.
* ColorBrewer and CARTOColors color ramps for single-band rasters, continuous or discrete.
* Custom per-pixel coloring functions, with full access to every band of the pixel.
* Band arithmetic on multispectral rasters, to compute and symbolize indices such as NDVI in the browser.
* Masking with GeoJSON polygons, and support for the COG's internal mask band.
* Raster metadata access, and pixel value queries at any location, with or without a map.
* Custom HTTP request headers, for COGs behind authentication.
* Works with vanilla JavaScript and with React Map GL.


## Typical use cases

* Satellite and aerial imagery viewers.
* Remote sensing analysis on multispectral imagery, computing indices such as NDVI, NDWI or NDBI directly in the map.
* Environmental and climate monitoring applications.
* Digital elevation models and terrain visualization.
* Precision agriculture and vegetation index maps.
* Multitemporal raster animation.
* Serverless geospatial data portals, and large scale raster publication without a map server.


## Live examples

Interactive demos covering RGB imagery, color ramps, NDVI on a multiband Sentinel-2 image, GeoJSON
masking, and a 12 GB digital elevation model covering Catalonia at 2 m/pixel:

* [MapLibre COG Protocol demo page](https://labs.geomatico.es/maplibre-cog-protocol/) — all the examples in this repository, running live.
* [Advanced sample viewer](https://labs.geomatico.es/maplibre-cog-protocol-examples/) — load and inspect your own COG URLs.
* [Serverless rasters in MapLibre: the COG protocol extension](https://geomatico.es/en/serverless-rasters-in-maplibre-the-cog-protocol-extension/) — article explaining the approach and why we built it.


## Installation

```shell
npm install @geomatico/maplibre-cog-protocol
```

Or load it from a CDN with a `<script>` tag, as shown in the [vanilla HTML example](#vanilla-html--js) below.


## Requirements

* MapLibre GL JS `^4.5.0`, `^5.0.0` or `^6.0.0` (peer dependency), except for `locationValues` and `getCogMetadata`, which work standalone. Note that MapLibre 6 dropped its UMD build, so it has to be loaded as an ES module, as in the example below.
* COGs **must** be in EPSG:3857 (Web Mercator). This library does not reproject; reading a COG in any other projection throws an error. See [COG generation tips](#cog-generation-tips).

## Usage

For better quality, use always `tileSize: 256` to match the size of tiles delivered by the custom protocol.

### Vanilla HTML & JS

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@^6.0.0/dist/maplibre-gl.css">
  <script src="https://unpkg.com/@geomatico/maplibre-cog-protocol/dist/index.js"></script>
</head>
<body>
<div id="map" style="width: 600px; height: 400px"></div>
<script type="module">
  import * as maplibregl from 'https://unpkg.com/maplibre-gl@^6.0.0/dist/maplibre-gl.mjs';

  let map = new maplibregl.Map({
    container: 'map',
    style: 'https://geoserveis.icgc.cat/contextmaps/icgc_mapa_base_gris_simplificat.json',
    center: [1.83369, 41.5937],
    zoom: 14
  });

  maplibregl.addProtocol('cog', MaplibreCOGProtocol.cogProtocol);

  map.on('load', () => {
    map.addSource('imageSource', {
      type: 'raster',
      url: 'cog://https://labs.geomatico.es/maplibre-cog-protocol/data/image.tif',
      tileSize: 256
    });

    map.addLayer({
      id: 'imageLayer',
      source: 'imageSource',
      type: 'raster'
    });
  });
</script>
</body>
</html>
```

### With React Map GL

`npm install @geomatico/maplibre-cog-protocol`

```tsx
import maplibregl from 'maplibre-gl';
import {cogProtocol} from '@geomatico/maplibre-cog-protocol';
import Map from 'react-map-gl/maplibre';

maplibregl.addProtocol('cog', cogProtocol);

const App = () =>
  <Map
    style={{width: 600, height: 400}}
    mapStyle="https://geoserveis.icgc.cat/contextmaps/icgc_mapa_base_gris_simplificat.json"
    initialViewState={{longitude: 1.83369, latitude: 41.5937, zoom: 14}}
  >
    <Source id="imageSource" type="raster" url="cog://https://labs.geomatico.es/maplibre-cog-protocol/data/image.tif" tileSize={256}>
      <Layer id="imageLayer" type="raster"/>
    </Source>
  </Map>;
```


## API

### Display image COGs

COGs are displayed as images according to their `PhotometricInterpretation` TIFF tag. Supported
interpretations are `WhiteIsZero`, `BlackIsZero` (grayscale), `RGB`, `Palette` (using the COG's own
color map), `CMYK`, `YCbCr` and `CIELab`. Any other value throws an error.

* Use a `raster` source with the url prepended with `cog://`
* Use a `raster` layer.

```javascript
  map.addSource('sourceId', {
    type: 'raster',
    url: 'cog://https://labs.geomatico.es/maplibre-cog-protocol/data/image.tif',
    tileSize: 256
  });

  map.addLayer({
    id: 'imageId',
    source: 'sourceId',
    type: 'raster'
  });
```

Transparency comes from the COG's `noData` value: pixels whose color bands all equal `noData` are
rendered fully transparent. A separate alpha band is not read, so generate your COGs with
`-co ADD_ALPHA=NO`, as in the [GDAL commands below](#cog-generation-tips). Beware that a COG
declaring no `noData` value at all falls back to treating 0 as transparent, which also makes
genuinely black pixels disappear; set an explicit `noData` to avoid this.

If instead you need transparency driven by a vector geometry, see
[Mask COG rendering with a GeoJSON polygon](#mask-cog-rendering-with-a-geojson-polygon).

### Display Digital Elevation Model COGs

Single-band COGs can be interpreted as DEMs. Elevations are taken from the first band, with the
COG's `scale` and `offset` applied, and encoded into RGB using the Mapbox Terrain-RGB scheme that
MapLibre expects.

#### As Hillshading

* Use a `raster-dem` source with the url prepended with `cog://` and appended with `#dem`
* Use a `hillshade` layer.

```javascript
  map.addSource('sourceId', {
    type: 'raster-dem',
    url: 'cog://https://cdn.geomatico.es/pirineo_dem_cog_256.tif#dem',
    tileSize: 256
  });

  map.addLayer({
    id: 'hillshadeId',
    source: 'sourceId',
    type: 'hillshade'
  });
```

#### As 3D Terrain

* Use a `raster-dem` source with the url prepended with `cog://` and appended with `#dem`, same as above.
* Set it as the terrain.

```javascript
  map.addSource('sourceId', {
    type: 'raster-dem',
    url: 'cog://https://cdn.geomatico.es/pirineo_dem_cog_256.tif#dem',
    tileSize: 256
  });

  map.setTerrain({
    source: 'sourceId'
  });
```


### Apply ColorBrewer or CARTOColor ramp to a single-band COG

COGs with a single band can be also converted to images applying a color ramp. Values are read from
the first band with `scale` and `offset` applied; `noData`, `NaN` and `Infinity` pixels are rendered
transparent.

* Use a `raster` source with the url prepended with `cog://` and appended with `#color:` and the color ramp specification.
* Use a `raster` layer.

```javascript
  map.addSource('sourceId', {
    type: 'raster',
    url: 'cog://https://labs.geomatico.es/maplibre-cog-protocol/data/kriging.tif#color:BrewerSpectral9,1.7,1.8,c',
    tileSize: 256
  });

  map.addLayer({
    id: 'imageId',
    source: 'sourceId',
    type: 'raster'
  });
```

The syntax for the `#color` parameter is `#color:<colorScheme>,<minValue>,<maxValue>,<modifiers>`, where:

* `<colorScheme>`: Mandatory parameter. One of the built-in color ramps, see the list of possible values in [Color Ramp cheatsheet](https://labs.geomatico.es/maplibre-cog-protocol/color-cheatsheet.html).
* `<minValue>, <maxValue>`: Define the data range for color mapping, should map your data's actual range. These are required if we want predictable results, as we can't rely on COG "stats" metadata (not always provided or correctly informed) and cannot read the whole file to get them (that's the point of the library, not having to).
* `<modifiers>`: Some characters representing additional configuration. We support:
  * `c` continuous color interpolation (vs discrete).
  * `-` reverse scale.

Some examples:

* Apply discrete `CartoEarth` ramp between 1 and 100: `#color:CartoEarth,1,100`
* Apply continuous `BrewerYlOrRd7` ramp between -1 and 1: `#color:BrewerYlOrRd7,-1,1,c`
* Same as above, reversed (so colors go red-orange-yellow instead of yellow-orange-red): `#color:CartoEarth,-1,1,c-`.

See other usages in [examples](examples). If you need more flexibility, use a Custom Color Function.


### Apply a Custom Color Function to any COG

In case you want to apply any other coloring logic, you can provide a function that
converts pixel values to RGBA color values, and assign it to the COG URL where it needs
to be applied.

Use the `setColorFunction` method, which needs two arguments:
* `cogUrl`: the COG to which the custom color function will be applied. Don't prepend the `cog://` protocol here.
* `colorFunction`: A function that maps pixel values to color values, whose arguments are:
    * `pixel`: A [TypedArray](src/types.ts#L45) with the raw pixel data as read from the geotiff, one value per band.
    * `color`: An Uint8ClampedArray of exactly 4 elements. Set the pixel color by setting the first, second, third and fourth element to `red`, `green`, `blue` and `alpha` values respectively.
    * `metadata`: [CogMetadata](src/types.ts#L27) structure with information about the COG, such as `noData`, `offset` or `scale` values.

Note that `pixel` holds the values as stored in the file: unlike `#dem` and `#color`, `scale` and
`offset` are **not** applied for you, so use `metadata.scale` and `metadata.offset` if your COG
declares them. A custom color function takes precedence over any `#dem` or `#color` hash on the URL.

The following example paints values below a given threshold as red, and green otherwise: 

```javascript
  const cogUrl = 'https://labs.geomatico.es/maplibre-cog-protocol/data/kriging.tif';
  const threshold = 1.75;
  
  // Function is called for every pixel, keep it fast!
  MaplibreCOGProtocol.setColorFunction(cogUrl, (pixel, color, metadata) => {
    if (pixel[0] === metadata.noData) {
      color.set([0, 0, 0, 0]);     // Transparent
    } else if (pixel[0] < threshold) {
      color.set([255, 0, 0, 255]); // Red
    } else {
      color.set([0, 255, 0, 255]); // Green
    }
  });

  map.addSource('sourceId', {
    type: 'raster',
    url: `cog://${cogUrl}`, // Use the same URL as in setColorFunction, preppended with "cog://".
    tileSize: 256
  });

  map.addLayer({
    id: 'imageId',
    source: 'sourceId',
    type: 'raster'
  });
```

This function will be called for each pixel, keep it as fast as possible!

Some other interesting usages: 

* Apply other color scales not listed in the builtin standard ColorBrewer or CartoColors catalog. 
* Use custom breakpoints or interpolations.
* Display other bands.
* Combine bands of a multispectral image to calculate indicators on the fly.


#### Band arithmetic on multispectral rasters

Because the `pixel` argument holds every band of the pixel, a color function can compute an index
from several bands and symbolize the result, without precomputing a derived raster. The following
example calculates NDVI from a 12-band Sentinel-2 COG and paints it with a d3 threshold scale:

```javascript
import {scaleThreshold} from 'd3-scale';

const url = './data/sentinel2.tif';

const ndviColorScale = scaleThreshold()
  .domain([-1.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8])
  .range([
    [0x00, 0x00, 0x00, 0xFF], //         NDVI < -1.0
    [0x2C, 0x7B, 0xB6, 0xFF], // -1.0 <= NDVI <  0.1
    [0xFD, 0xAE, 0x61, 0xFF], //  0.1 <= NDVI <  0.2
    [0xFE, 0xE0, 0x8B, 0xFF], //  0.2 <= NDVI <  0.3
    [0xFF, 0xFF, 0xBF, 0xFF], //  0.3 <= NDVI <  0.4
    [0xD9, 0xEF, 0x8B, 0xFF], //  0.4 <= NDVI <  0.5
    [0xA6, 0xD9, 0x6A, 0xFF], //  0.5 <= NDVI <  0.6
    [0x66, 0xBD, 0x63, 0xFF], //  0.6 <= NDVI <  0.7
    [0x1A, 0x98, 0x50, 0xFF], //  0.7 <= NDVI <  0.8
    [0x00, 0x68, 0x37, 0xFF]  //         NDVI >= 0.8
  ])
  .unknown([0x00, 0x00, 0x00, 0x00]); // NaN or undefined => transparent

setColorFunction(url, (pixel, color) => {
  const [B01, B02, B03, B04, B05, B06, B07, B08, B09, B11, B12, B8A] = pixel;
  const NDVI = (B8A - B04) / (B8A + B04);

  color.set(ndviColorScale(NDVI));
});
```

The same arithmetic works for any other index (NDWI, NDBI, burn severity...), and changing the
formula, the thresholds or the palette only requires reloading the layer, never regenerating data.
Pair it with [`locationValues`](#get-pixel-values-for-a-given-location) to read the index value under
the cursor.

See the [custom color example](examples/custom-color.html) for the full working demo, which does
exactly this over a Sentinel-2 image and shows the NDVI value on mouse hover.

To remove a previously set color function and go back to the default rendering, pass `undefined` as
the second argument:

```javascript
setColorFunction(cogUrl, undefined);
```

Changing the color function only affects tiles rendered from then on, as MapLibre keeps already
rendered tiles. To force a refresh, remove and re-add the layer:

```javascript
setColorFunction(cogUrl, newColorFunction);
map.removeLayer('imageLayer');
map.addLayer({id: 'imageLayer', source: 'sourceId', type: 'raster'});
```

The [timeseries example](examples/timeseries.html) uses this to animate through the bands of a
multi-band COG.


### Reuse the built-in color ramps

The color ramps used by `#color:` are also exported, so a custom color function can reuse them:

* `colorSchemeNames`: array with the names of every built-in ramp.
* `colorScale({colorScheme, min, max, isContinuous, isReverse})`: returns an interpolator function
  mapping a value to an `[r, g, b]` array. `isContinuous` and `isReverse` default to `false` and are
  the equivalent of the `c` and `-` URL modifiers. Alternatively to `colorScheme`, a `customColors`
  array of at least two hex colors can be given.

```javascript
import {colorScale, setColorFunction} from '@geomatico/maplibre-cog-protocol';

const interpolate = colorScale({colorScheme: 'BrewerRdYlBu10', min: 1, max: 7, isContinuous: true});

setColorFunction(url, (pixel, color, {noData, scale, offset}) => {
  const value = pixel[0];
  if (value === noData) {
    color[3] = 0;
  } else {
    color.set([...interpolate(value * scale + offset), 224]); // 224 = semi-transparent
  }
});
```

The [Color Ramp cheatsheet](examples/color-cheatsheet.html) is built with these two exports.


### Transparency from the COG's internal mask band

No API needed: if the COG contains an internal mask band (a TIFF image whose `NewSubfileType` has
the mask bit set), it is read alongside the data and pixels masked out in the file are rendered
fully transparent. This applies to every rendering mode, custom color functions included.

GDAL carries such a band over when the source dataset already has one.


### Mask COG rendering with a GeoJSON polygon

Use `setMask` to restrict rendering to the area covered by a GeoJSON `FeatureCollection` of `Polygon` or `MultiPolygon` features. Pixels outside the mask are set to transparent. Other geometry types in the collection are ignored.

Use `clearMask` (or `setMask(undefined)`) to remove the mask.

The mask is global and applies to every COG source currently on the map. As with color functions, it
takes effect on tiles rendered from then on, so set it before adding the source, or force a refresh
by removing and re-adding the layer. Masking relies on `OffscreenCanvas`; where that is unavailable,
tiles are rendered unmasked.

```javascript
import {setMask, clearMask} from '@geomatico/maplibre-cog-protocol';

const mask = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[[2.0, 41.0], [3.0, 41.0], [3.0, 42.0], [2.0, 42.0], [2.0, 41.0]]]
    },
    properties: {}
  }]
};

setMask(mask);   // apply mask
clearMask();     // remove mask
```

See [masking example](examples/masking.html) for a full working demo.


### [unstable] Get COG metadata

Use the `getCogMetadata(url)` to obtain metadata about a COG file. It returns a promise resolving to:

* `offset`, `scale`: GDAL offset and scale for the first band, defaulting to `0.0` and `1.0`.
* `noData`: noData value for the first band, or `undefined`.
* `bbox`: `[west, south, east, north]` bounds, in geographic coordinates.
* `artist`: the TIFF `Artist` tag, if present.
* `photometricInterpretation`, `bitsPerSample`, `colorMap`: raw TIFF tags used for rendering.
* `images`: one entry per image in the file (full resolution, overviews and masks), each with its
  `zoom` level and the `isOverview` / `isMask` flags.

These are internals that may change in future releases, so use with caution. The promise rejects if
the COG is not in EPSG:3857.

Usage example:

```javascript
MaplibreCOGProtocol.getCogMetadata(url).then(metadata => console.log(metadata.bbox));
```

See the [metadata example](examples/metadata.html) for an interactive version.


### Get pixel values for a given location

The `locationValues(url, location, zoom?)` method reads pixel values for a given location, with the COG's `scale` and `offset` applied. It returns an array of numbers, one for each band in the COG. NaNs are returned when querying outside of the image, or for `noData` pixels. If zoom is indicated, it will query the nearest overview corresponding to that zoom level; otherwise the full resolution image is used.

Example usage in conjunction with maplibre API to get COG values on mouse hover:

```javascript
import {locationValues} from '@geomatico/maplibre-cog-protocol';

map.on('mousemove', ({lngLat}) => {
  locationValues(
    './data/kriging.tif',
    {latitude: lngLat.lat, longitude: lngLat.lng},
    map.getZoom()
  ).then(console.log);
});
```

`locationValues` doesn't depend on MapLibre API or the CogProtocol, so it can be used to query raster values in applications without a map:

```javascript
import {locationValues} from '@geomatico/maplibre-cog-protocol';

const url = 'https://labs.geomatico.es/maplibre-cog-protocol/data/kriging.tif';
locationValues(url, {latitude: 41.656278, longitude: 0.501394}).then(console.log);
```


### Send custom request headers

Use `setRequestHeaders(headers)` to add HTTP headers to the requests made to fetch COGs, for
instance to read from a server requiring authentication:

```javascript
import {setRequestHeaders} from '@geomatico/maplibre-cog-protocol';

setRequestHeaders({Authorization: 'Bearer <token>'});
```

The headers are global, applying to every COG read afterwards, including `locationValues` and
`getCogMetadata`. Because opened files are cached, call this before the COG is first requested; a
later call won't affect files already opened.


## Notes

* **Attribution**: the TIFF `Artist` tag of the COG, if present, is exposed as the source
  attribution, and thus shown in MapLibre's attribution control.
* **Zoom range**: the source's `maxzoom` is derived from the resolution of the COG's own overviews,
  and `minzoom` is always 0. Zooming beyond the COG's resolution upsamples the highest resolution
  image available.
* **Caching**: opened files, their metadata and the decoded tiles are cached in memory, keyed by
  URL, and expire after an hour. Requesting a tile that is already cached issues no network request.


## COG generation tips

COG should be in EPSG:3857 (Google Mercator) projection, as this library doesn't reproject and won't understand any other projection.

For better performance, use the Google Maps tiling scheme with 256x256 blocksize.

For RGB images, JPEG yCbCr (lossy) compression is recommended.
For lossless compression, deflate gives good decoding performance on the browser.

Sample GDAL commands (using docker for convenience, but not needed):

#### RGB Image (lossy compression)

```bash
docker run --rm -v .:/srv ghcr.io/osgeo/gdal:alpine-small-3.9.1 gdalwarp /srv/<source>.tif /srv/<target>.tif -of COG -co BLOCKSIZE=256 -co TILING_SCHEME=GoogleMapsCompatible -co COMPRESS=JPEG -co OVERVIEWS=IGNORE_EXISTING -co ADD_ALPHA=NO -dstnodata NaN
```

#### Digital Elevation Model

```bash
docker run --rm -v .:/srv ghcr.io/osgeo/gdal:alpine-small-3.9.1 gdalwarp /srv/<source>.tif /srv/<target>.tiff -of COG -co BLOCKSIZE=256 -co TILING_SCHEME=GoogleMapsCompatible -co COMPRESS=DEFLATE -co RESAMPLING=BILINEAR -co OVERVIEW_RESAMPLING=NEAREST -co OVERVIEWS=IGNORE_EXISTING -co ADD_ALPHA=NO -dstnodata NaN
```

## For developers

Node version is the one in `.nvmrc`.

```bash
npm install
npm test          # lint and run the test suite with coverage
npm run watch     # rebuild dist/ and serve examples/ with live reload
```

Breaking changes between versions are documented in [MIGRATIONS.md](MIGRATIONS.md).

### Making a new release

```
npm version [patch | minor | major]

npm run build
npm publish --access public

git push origin tag vX.X.X
npm run gh-publish  # publish examples to labs.geomatico.es
```


## About Geomatico

MapLibre COG Protocol is developed and maintained by [Geomatico](https://geomatico.es/en/), an open
source geospatial software development and GIS consulting company.

We build custom web mapping platforms, raster processing workflows and geospatial applications using
MapLibre, TypeScript, PostGIS, GDAL, GeoServer and cloud native spatial data formats, with a focus on
geographic information analysis and publishing, mobility and the environment.

Need to publish satellite imagery, elevation models or other large raster datasets on the web?
[Talk to Geomatico](https://geomatico.es/en/).


## License

[MIT](LICENSE)
