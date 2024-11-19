# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Support arbitrary color functions for multiband COGs
- Added NDVI HTML example 
- Added CHANGELOG

### Changed

- DEPRECATED ability to provide a custom array of colors as URL hash: `#color:["#ffeda0","#feb24c","#f03b20"]`. Use the new `setCustomColor` method instead, see README. 

### Removed

- 

### Fixed

-


## [0.3.1] - 2024-09-19

### Changed

- Updated README with publish instructions
- More precise DEM for Cat

### Fixed

- Apply scale and offset to locationValues


## [0.3.0] - 2024-09-10

### Added

- Added license to package.json
- Add ability to provide a custom array of colors `#color:["#ffeda0","#feb24c","#f03b20"]`

### Changed

- Use unpkg import in vanilla js example

### Fixed

- Fixed rgba.fromPalette


## [0.2.1] - 2024-08-26

### Fixed

- Don't use @/ alias in imports, as .d.ts files are not emitted correctly on build


## [0.2.0] - 2024-08-13

### Added

- Added QuickLRU cache to CogReader
- Added a method to get a COG value given a screen pixel (lat, lon, zoom)

### Fixed

- Remove duplicate 'cog://' from README


## [0.1.2] - 2024-07-30

### Changed

- Improved examples and README


## [0.1.1] - 2024-07-26

### Fixed

- Fix build directory structure


## [0.1.0] - 2024-07-26

### Added

- TypeScript type declaration
- Tests
- gh-pages
- DEM example

### Changed

- Major refactor of cogProtocol: Separate renderers, readers and math.
- Improved ColorInterpolator, removing dependency of GeoComponents
- README: Recommend ALIGNED_LEVELS option on COG creation.
- README: Recommend usage of `tileSize: 256` on style source declaration.


## [0.0.1] - 2024-07-09

### Added

- First distributable version, under MIT license
- cogProtocol can read RGB images, based on a modified version of `readRGB` class from [geotiff.js](https://www.npmjs.com/package/geotiff.js)
- cogProtocol can read single-band DEMS as TerrainRGB ("raster-dem" sources)
- cogProtocol can apply color scale on a single-band COG based on [@geomatico/geocomponents](https://www.npmjs.com/package/@geomatico/geocomponents) `useColorRamp`
- README with Vanilla and react-map-gl examples, and tips on generating COGs with gdalwarp
- HTML examples for image and color-ramp cases, pushed to https://labs.geomatico.es/maplibre-cog-protocol
- Typescript configuration
- Rollup configured to bundle a UMD module with sourcemaps and type definitions
- Jest configured for testing, but no real testing is done (dummy)
- npm tasks for building, linting, testing, deploying and dev server


[unreleased]: https://github.com/geomatico/maplibre-cog-protocol/compare/v1.1.1...HEAD
[0.3.1]: https://github.com/geomatico/maplibre-cog-protocol/compare/v0.3.1...v0.3.0
[0.3.0]: https://github.com/geomatico/maplibre-cog-protocol/compare/v0.3.0...v0.2.1
[0.2.1]: https://github.com/geomatico/maplibre-cog-protocol/compare/v0.2.1...v0.2.0
[0.2.0]: https://github.com/geomatico/maplibre-cog-protocol/compare/v0.2.0...v0.1.2
[0.1.2]: https://github.com/geomatico/maplibre-cog-protocol/compare/v0.1.2...v0.1.1
[0.1.1]: https://github.com/geomatico/maplibre-cog-protocol/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/geomatico/maplibre-cog-protocol/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/geomatico/maplibre-cog-protocol/releases/tag/v0.0.1
