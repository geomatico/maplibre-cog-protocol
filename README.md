# Maplibre COG Protocol

Custom protocol to load Cloud Optimized GeoTIFFs (COG) in Maplibre GL JS


## Demo page

**https://labs.geomatico.es/maplibre-cog-protocol**

## Usage

For better quality, use always `tileSize: 256` to match the size of tiles delivered by the custom protocol.

### Vanilla HTML & JS

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl/dist/maplibre-gl.css">
  <script src="https://unpkg.com/maplibre-gl/dist/maplibre-gl.js"></script>
  <script src="https://unpkg.com/@geomatico/maplibre-cog-protocol/dist/index.js"></script>
</head>
<body>
<div id="map" style="width: 600px; height: 400px"></div>
<script>
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

### Display RGB image COGs

COGs with three or four 8-bit bands can be displayed as RGB or RGBA images.

* Use a `raster` source with the url prepended with `cog://`
* Use a `raster` layer.

```javascript
  map.addSource('sourceId', {
    type: 'raster',
    url: 'cog://https://labs.geomatico.es/maplibre-cog-protocol/data/image.tif',
  });

  map.addLayer({
    id: 'imageId',
    source: 'sourceId',
    type: 'raster'
  });
```

### Display Digital Elevation Model COGs

COGs with a single band can be interpreted DEMs.

#### As Hillshading

* Use a `raster-dem` source with the url prepended with `cog://` and appended with `#dem`
* Use a `hillshade` layer.

```javascript
  map.addSource('sourceId', {
    type: 'raster-dem',
    url: 'cog://https://cdn.geomatico.es/pirineo_dem_cog_256.tif#dem',
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
  });

  map.setTerrain({
    source: 'sourceId'
  });
```


### Apply a color ramp to a single band COG

COGs with a single band can be also converted to images applying a color ramp.

* Use a `raster` source with the url prepended with `cog://` and appended with `#color:` and the color ramp specification or an array of custom hex codes.
* Use a `raster` layer.

#### ColorBrewer or CARTOColors

```javascript
  map.addSource('sourceId', {
    type: 'raster',
    url: 'cog://https://labs.geomatico.es/maplibre-cog-protocol/data/kriging.tif#color:BrewerSpectral9,1.7,1.8,c',
  });

  map.addLayer({
    id: 'imageId',
    source: 'sourceId',
    type: 'raster'
  });
```

#### Custom Colors

```javascript
  map.addSource('sourceId', {
    type: 'raster',
    url: 'cog://https://labs.geomatico.es/maplibre-cog-protocol/data/kriging.tif#color:["#ffeda0","#feb24c","#f03b20"],1.7,1.8,c',
  });

  map.addLayer({
    id: 'imageId',
    source: 'sourceId',
    type: 'raster'
  });
```

The color ramp specification consists of the following comma-separated values:

```
#color:<colorScheme/customColors>,<min>,<max>,<options>
```

* `colorScheme`: Any of the [Color Brewer](https://colorbrewer2.org/) or [CARTOColors](https://carto.com/carto-colors/) schemes are available. See [the Color Ramp cheatsheet](https://labs.geomatico.es/maplibre-cog-protocol/colors.html).
* `customColors`: An array of hex codes for your color ramp.
* `min`: A number indicating the minimal value where the color ramp applies.
* `max`: A number indicating the maximal value where the color ramp applies.
* `options` (optional):
  * add a `-` to apply the reversed scheme (for instance, converts red-to-gren => green-to-red).
  * add a `c` to apply a continuous color scale (linear interpolation).


### Get pixel values for a given location

The `locationValues(url, location, zoom?)` method reads raw pixel values for a given location. It returns an array of numbers, one for each band in the COG. NaNs are returned when querying outside of the image. If zoom is indicated, it will query the nearest overview corresponding to that zoom level.

Example usage in conjunction with maplibre API to get COG values on mouse hover:

```javascript
import {locationValues} from 'maplibre-cog-protocol';

map.on('mousemove', ({lngLat}) => {
  locationValues(
    './data/kriging.tif',
    {latitude: lngLat.lat, longitude: lnglat.lon},
    map.getZoom()
  ).then(console.log);
});
```

`locationValues` doesn't depend on Maplibre API or the CogProtocol, so it can be used to query raster values in applications without a map:

```javascript
import {locationValues} from 'maplibre-cog-protocol';

const url = 'https://labs.geomatico.es/maplibre-cog-protocol/data/kriging.tif';
locationValues(url, {latitude: 41.656278, longitude: 0.501394}).then(console.log);
```


## COG generation tips

COG should be in EPSG:3857 (Google Mercator) projection, as this library doesn't reproject and won't understand any other projection.

For better performance, use the Google Maps tiling scheme with 256x256 blocksize.

For RGB images, JPEG yCbCr (lossy) compression is recommended.
For lossless compression, deflate gives good decoding performance on the browser.

Sample GDAL commands (using docker for convenience, but not needed):

#### RGB Image (lossy compression)

```bash
docker run --rm -v .:/srv ghcr.io/osgeo/gdal:alpine-small-3.9.1 gdalwarp /srv/<source>.tif /srv/<target>.tif -of COG -co BLOCKSIZE=256 -co TILING_SCHEME=GoogleMapsCompatible -co COMPRESS=JPEG -co OVERVIEWS=IGNORE_EXISTING -co ADD_ALPHA=NO -co ALIGNED_LEVELS=10 -dstnodata NaN
```

#### Digital Elevation Model

```bash
docker run --rm -v .:/srv ghcr.io/osgeo/gdal:alpine-small-3.9.1 gdalwarp /srv/<source>.tif /srv/<target>.tiff -of COG -co BLOCKSIZE=256 -co TILING_SCHEME=GoogleMapsCompatible -co COMPRESS=DEFLATE -co RESAMPLING=BILINEAR -co OVERVIEW_RESAMPLING=NEAREST -co OVERVIEWS=IGNORE_EXISTING -co ADD_ALPHA=NO -co ALIGNED_LEVELS=10 -dstnodata NaN
```

## For developers

### Making a new release

```
npm version [patch | minor | major]

npm run build
npm publish --access public

git tag vX.X.X
git push origin tag vX.X.X
```

### Feature wishlist

1. [ ] Apply transparency mask if present (now taking 0 as the default noData value)
2. [ ] Raster algebra for multiband GeoTIFFs
3. [ ] Integrate maplibre-contour
