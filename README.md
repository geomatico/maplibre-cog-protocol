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


## Usage

See the [self-documented examples](https://labs.geomatico.es/maplibre-cog-protocol-examples).

* COGs with three 8-bit bands will be displayed as RGB images.
* COGs with a single band can be used:
  * As an image, applying any color ramp from ColorBrewer or Carto Colors.
  * As a DEM for hillshading (source type="raster-dem").
  * As a DEM for 3D terrain (source type="raster-dem").


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

## [dev] Releasing a new version

```
npm version [patch | minor | major]

npm run build
npm pack
npm publish --access public
```
