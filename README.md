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
    <link rel="stylesheet" href="https://unpkg.com/maplibre-gl/dist/maplibre-gl.css" />
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
        zoom: 14,
      });

      maplibregl.addProtocol('cog', MaplibreCOGProtocol.cogProtocol);

      map.on('load', () => {
        map.addSource('imageSource', {
          type: 'raster',
          url: 'cog://https://labs.geomatico.es/maplibre-cog-protocol/data/image.tif',
          tileSize: 256,
        });

        map.addLayer({
          id: 'imageLayer',
          source: 'imageSource',
          type: 'raster',
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
import { cogProtocol } from '@geomatico/maplibre-cog-protocol';
import Map from 'react-map-gl/maplibre';

maplibregl.addProtocol('cog', cogProtocol);

const App = () => (
  <Map
    style={{ width: 600, height: 400 }}
    mapStyle="https://geoserveis.icgc.cat/contextmaps/icgc_mapa_base_gris_simplificat.json"
    initialViewState={{ longitude: 1.83369, latitude: 41.5937, zoom: 14 }}
  >
    <Source id="imageSource" type="raster" url="cog://https://labs.geomatico.es/maplibre-cog-protocol/data/image.tif" tileSize={256}>
      <Layer id="imageLayer" type="raster" />
    </Source>
  </Map>
);
```

## API

### Display RGB image COGs

COGs with three or four 8-bit bands can be displayed as RGB or RGBA images.

- Use a `raster` source with the url prepended with `cog://`
- Use a `raster` layer.

```javascript
map.addSource('sourceId', {
  type: 'raster',
  url: 'cog://https://labs.geomatico.es/maplibre-cog-protocol/data/image.tif',
});

map.addLayer({
  id: 'imageId',
  source: 'sourceId',
  type: 'raster',
});
```

### Display Digital Elevation Model COGs

COGs with a single band can be interpreted DEMs.

#### As Hillshading

- Use a `raster-dem` source with the url prepended with `cog://` and appended with `#dem`
- Use a `hillshade` layer.

```javascript
map.addSource('sourceId', {
  type: 'raster-dem',
  url: 'cog://https://cdn.geomatico.es/pirineo_dem_cog_256.tif#dem',
});

map.addLayer({
  id: 'hillshadeId',
  source: 'sourceId',
  type: 'hillshade',
});
```

#### As 3D Terrain

- Use a `raster-dem` source with the url prepended with `cog://` and appended with `#dem`, same as above.
- Set it as the terrain.

```javascript
map.addSource('sourceId', {
  type: 'raster-dem',
  url: 'cog://https://cdn.geomatico.es/pirineo_dem_cog_256.tif#dem',
});

map.setTerrain({
  source: 'sourceId',
});
```

### Apply ColorBrewer or CARTOColor ramp to a single-band COG

COGs with a single band can be also converted to images applying a color ramp.

- Use a `raster` source with the url prepended with `cog://` and appended with `#color:` and the color ramp specification.
- Use a `raster` layer.

```javascript
map.addSource('sourceId', {
  type: 'raster',
  url: 'cog://https://labs.geomatico.es/maplibre-cog-protocol/data/kriging.tif#color:BrewerSpectral9,1.7,1.8,c',
});

map.addLayer({
  id: 'imageId',
  source: 'sourceId',
  type: 'raster',
});
```

### Apply a Custom Color Function to any COG

In case you want to apply any other coloring logic, you can provide a function that
converts pixel values to RGBA color values, and assign it to the COG URL where it needs
to be applied.

Use the `setColorFunction` method, which needs two arguments:

- `cogUrl`: the COG to which the custom color function will be applied. Don't prepend the `cog://` protocol here.
- `colorFunction`: A function that maps pixel values to color values, whose arguments are:
  - `pixel`: An array of numeric values, one for each band. If defined in COG metadata, `offset` and `scale` are already applied to each value.
  - `color`: An Uint8ClampedArray of exactly 4 elements. Set the pixel color by setting the first, second, third and fourth element to `red`, `green`, `blue` and `alpha` values respectively.
  - `metadata`: [CogMetadata](src/types.ts#L27) structure with information about the COG, such as the `noData` value.

The following example paints values below a given threshold as red, and green otherwise:

```javascript
const cogUrl = 'https://labs.geomatico.es/maplibre-cog-protocol/data/kriging.tif';
const threshold = 1.75;

// Function is called for every pixel, keep it fast!
MaplibreCOGProtocol.setColorFunction(cogUrl, (pixel, color, metadata) => {
  if (pixel[0] === metadata.noData) {
    color.set([0, 0, 0, 0]); // Transparent
  } else if (pixel[0] < threshold) {
    color.set([255, 0, 0, 255]); // Red
  } else {
    color.set([0, 255, 0, 255]); // Green
  }
});

map.addSource('sourceId', {
  type: 'raster',
  url: `cog://${cogUrl}`, // Use the same URL as in setColorFunction, prepended with "cog://".
});

map.addLayer({
  id: 'imageId',
  source: 'sourceId',
  type: 'raster',
});
```

Some other interesting usages:

- Apply other color scales not listed in the builtin standard ColorBrewer or CartoColors catalog.
- Use custom breakpoints or interpolations.
- Display other bands.
- Combine bands of a multispectral image to calculate indicators on the fly.

### Get pixel values for a given location

The `locationValues(url, location, zoom?)` method reads raw pixel values for a given location. It returns an array of numbers, one for each band in the COG. NaNs are returned when querying outside of the image. If zoom is indicated, it will query the nearest overview corresponding to that zoom level.

Example usage in conjunction with maplibre API to get COG values on mouse hover:

```javascript
import { locationValues } from '@geomatico/maplibre-cog-protocol';

map.on('mousemove', ({ lngLat }) => {
  locationValues('./data/kriging.tif', { latitude: lngLat.lat, longitude: lnglat.lon }, map.getZoom()).then(console.log);
});
```

`locationValues` doesn't depend on Maplibre API or the CogProtocol, so it can be used to query raster values in applications without a map:

```javascript
import { locationValues } from '@geomatico/maplibre-cog-protocol';

const url = 'https://labs.geomatico.es/maplibre-cog-protocol/data/kriging.tif';
locationValues(url, { latitude: 41.656278, longitude: 0.501394 }).then(console.log);
```

### Masking a COG

Masking can be applied to COGs by providing a GeoJSON feature collection of polygons/multipolygons. This will only color the pixels inside the polygons, and the rest will be transparent.

```javascript
MaplibreCOGProtocol.setMask({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
         type: 'Polygon',
        coordinates: [
          ...
        ],
      },
    },
  ],
});
```

### Clearing the mask

To remove the mask, call the `clearMask` method:

```javascript
MaplibreCOGProtocol.clearMask();
```

You will also need to force the map to redraw the COG layer.

## COG generation tips

COG should be in EPSG:3857 (Google Mercator) projection, as this library doesn't reproject and won't understand any other projection.

For better performance, use the Google Maps tiling scheme with 256x256 blocksize.

For RGB images, JPEG yCbCr (lossy) compression is recommended.
For lossless compression, deflate gives good decoding performance on the browser.

Sample GDAL commands (using docker for convenience, but not needed):

### RGB Image (lossy compression)

```bash
docker run --rm -v .:/srv ghcr.io/osgeo/gdal:alpine-small-3.9.1 gdalwarp /srv/<source>.tif /srv/<target>.tif -of COG -co BLOCKSIZE=256 -co TILING_SCHEME=GoogleMapsCompatible -co COMPRESS=JPEG -co OVERVIEWS=IGNORE_EXISTING -co ADD_ALPHA=NO -co ALIGNED_LEVELS=10 -dstnodata NaN
```

### Digital Elevation Model

```bash
docker run --rm -v .:/srv ghcr.io/osgeo/gdal:alpine-small-3.9.1 gdalwarp /srv/<source>.tif /srv/<target>.tiff -of COG -co BLOCKSIZE=256 -co TILING_SCHEME=GoogleMapsCompatible -co COMPRESS=DEFLATE -co RESAMPLING=BILINEAR -co OVERVIEW_RESAMPLING=NEAREST -co OVERVIEWS=IGNORE_EXISTING -co ADD_ALPHA=NO -co ALIGNED_LEVELS=10 -dstnodata NaN
```

## For developers

### Making a new release

```sh
npm version [patch | minor | major]

npm run build
npm publish --access public

git push origin tag vX.X.X
npm run gh-publish  # publish examples to labs.geomatico.es
```

### Feature wishlist

1. [ ] Apply transparency mask if present (now taking 0 as the default noData value)
2. [ ] Integrate maplibre-contour
