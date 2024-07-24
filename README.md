# Maplibre COG Protocol

Custom protocol to load Cloud Optimized GeoTIFFs (COG) in Maplibre GL JS


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
docker run --rm -v .:/srv ghcr.io/osgeo/gdal:alpine-small-3.9.1 gdalwarp /srv/<source>.tif /srv/<target>.tiff -of COG -co BLOCKSIZE=256 -co TILING_SCHEME=GoogleMapsCompatible -co COMPRESS=DEFLATE -co RESAMPLING=BILINEAR -co OVERVIEWS=IGNORE_EXISTING -co ADD_ALPHA=NO -dstnodata NaN
```

## Application examples

### Vanilla HTML & JS

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl/dist/maplibre-gl.css">
  <script src="https://unpkg.com/maplibre-gl/dist/maplibre-gl.js"></script>
  <script src="https://labs.geomatico.es/maplibre-cog-protocol/dist/index.js"></script>
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
    <Source id="imageSource" type="raster" url="cog://https://labs.geomatico.es/maplibre-cog-protocol/data/image.tif">
      <Layer id="imageLayer" type="raster"/>
    </Source>
  </Map>;
```


## API

See the [self-documented examples](https://labs.geomatico.es/maplibre-cog-protocol-examples).

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
    url: 'cog://cog://https://cdn.geomatico.es/pirineo_dem_cog_256.tif#dem',
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
    url: 'cog://cog://https://cdn.geomatico.es/pirineo_dem_cog_256.tif#dem',
  });

  map.setTerrain({
    source: 'sourceId'
  });
```


### Apply a color ramp to a single band COG

COGs with a single band can be also converted to images applying a color ramp.

* Use a `raster` source with the url prepended with `cog://` and appended with `#color:` and the color ramp specification.
* Use a `raster` layer.

```javascript
  map.addSource('sourceId', {
    type: 'raster',
    url: 'cog://https://labs.geomatico.es/maplibre-cog-protocol/data/kriging#color:BrewerSpectral9,1.7,1.8,c',
  });

  map.addLayer({
    id: 'imageId',
    source: 'sourceId',
    type: 'raster'
  });
```

The color ramp specification consists of the following comma-separated values:

```
#color:<colorScheme>,<min>,<max>,<options>
```

* `colorScheme`: Any of the [Color Brewer](https://colorbrewer2.org/) or [CARTOColors](https://carto.com/carto-colors/) schemes are available. See [the Color Ramp cheatsheet](https://labs.geomatico.es/maplibre-cog-protocol/colors.html).
* `min`: A number indicating the minimal value where the color ramp applies.
* `max`: A number indicating the maximal value where the color ramp applies.
* `options` (optional):
  * add a `-` to apply the reversed scheme (for instance, converts red-to-gren => green-to-red).
  * add a `c` to apply a continuous color scale (linear interpolation).


## For developers

### Releasing a new version

```
npm version [patch | minor | major]

npm run build
npm pack
npm publish --access public
```

### Roadmap

Robustness and efficiency:

1. [ ] Improve handling of NaNs, NO_DATA, masks + single-pass generation of RGBA ImageData
2. [ ] Get the exact tile from COG, improve cache and concurrency
3. [ ] Usage of web workers

Desire list:

1. [ ] Get pixel info on mouse hover/click/tap
2. [ ] Raster algebra on multiband geotiffs
3. [ ] Integrate maplibre-contour
