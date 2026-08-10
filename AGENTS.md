# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

`@geomatico/maplibre-cog-protocol` registers a `cog://` custom protocol with MapLibre GL JS so a
Cloud Optimized GeoTIFF can be used directly as a `raster` or `raster-dem` source, with no tile
server. The library fetches byte ranges of the remote GeoTIFF, decodes the pixels for the requested
XYZ tile, converts them to RGBA, and hands MapLibre an `ImageBitmap`.

Hard constraint: **COGs must be in EPSG:3857 (Web Mercator)**. There is no reprojection; a COG with
any other `ProjectedCSTypeGeoKey` throws in `getMetadata`.

## Commands

```bash
npm test                       # biome check --write src/ + vitest run + coverage + junit.xml
npx vitest run test/read/CogReader.spec.ts   # single test file
npx vitest run -t 'name substring'           # single test by name
npx vitest                     # watch mode
npm run lint                   # biome check --write src/  (formats and fixes in place)
npm run build                  # UMD (rollup) + ESM (tsc) + .d.ts, in parallel, into dist/
npm run watch                  # rebuild dist/ + serve examples/ at once (dev loop)
```

Node version is pinned in `.nvmrc` (24). `npm test` runs on every commit via the husky pre-commit
hook, and in CI on pull requests (`.github/workflows`), which also runs `npm run build`.

There is no typecheck script; `npm run build:esm` / `build:types` are what surface type errors.
Biome only covers `src/` — `test/` is neither linted nor formatted, and `tsconfig.test.json`
(loose, `strict: false`) exists for editor support only, not wired to any script.

## Manual verification

The `examples/` directory is the real test bed — automated tests use fake GeoTIFFs, so anything
touching decoding or rendering should be eyeballed there. `npm run watch` builds `dist/` and serves
`examples/` (which loads `/dist`) with live reload. Sample COGs live in `examples/data/`.

## Architecture

Request flow for one tile (`src/cogProtocol.ts` is the entry point and the only MapLibre-aware file):

1. MapLibre asks for `cog://<url>#<hash>` with `type: 'json'` → `CogReader(url).getTilejson()`
   synthesizes a TileJSON whose `maxzoom` comes from the COG's own overview resolutions and whose
   `bounds` come from its bbox.
2. MapLibre then asks for `cog://<url>#<hash>/{z}/{x}/{y}` with `type: 'image'` → `renderTile()`
   parses the URL, reads raw pixels + the optional mask band, picks a renderer from the hash, and
   returns an `ImageBitmap`.

Two layers under `src/`:

- **`read/`** — everything that touches the file. `CogReader` is a factory over `geotiff.js` with
  three module-level `QuickLRU` caches (GeoTIFF handles, metadata, decoded tiles) shared across all
  reader instances, plus one shared decoder `Pool`. `getRawTile` selects the overview image whose
  zoom is the closest at-or-above the requested `z` (falling back to the highest available below),
  converts the XYZ tile to a pixel window in that image (`read/math.ts`), and resamples to 256×256.
  The same function reads the mask band via `{mask: true}`, which filters to images with the
  `NewSubfileType` mask bit and returns `null` when the COG has none.
- **`render/`** — pure pixel transforms, no I/O. Each renderer has the shape
  `ImageRenderer<Options> = (data: TypedArray, options) => Uint8ClampedArray`, taking an
  interleaved raster and returning RGBA.

Renderer selection in `renderTile`, in priority order:

| Condition                                             | Renderer                                                                                                                                              |
|-------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| a custom color function registered for that exact URL | `render/custom/` (per-pixel user callback)                                                                                                            |
| hash starts with `dem`                                | `renderTerrain` — packs elevation into RGB using the Mapbox Terrain-RGB encoding                                                                      |
| hash starts with `color`                              | `renderColor` — parses `#color:<scheme>,<min>,<max>,<modifiers>` and applies a d3 scale from `colorScale.ts`                                          |
| otherwise                                             | `renderPhoto` — dispatches on the TIFF `PhotometricInterpretation` tag to the conversions in `rgba.ts` (RGB, palette, CMYK, YCbCr, CIELab, grayscale) |

Two independent masking mechanisms, applied in this order after rendering: the COG's own internal
mask band (zeroes alpha where the band is 0), then the global user GeoJSON mask
(`render/mask.ts`), which rasterizes polygons on an `OffscreenCanvas` with
`destination-in` compositing. The GeoJSON mask is module-global state — one mask for all COG
sources — and is a no-op where `OffscreenCanvas` is unavailable (i.e. in the Node test env).

Custom color functions are also global module state (`render/custom/rendererStore.ts`), keyed by
the bare COG URL without the `cog://` prefix.

`src/index.ts` is the public surface. Anything not exported there is internal, except
`getCogMetadata`, which the README explicitly marks unstable.

## Conventions

- Formatting is Biome, and `npm run lint` writes fixes — don't hand-format. Single quotes, no
  bracket spacing (`{foo}` not `{ foo }`), 120 columns, semicolons.
- Prefer proper typing or narrowing over the `as` keyword. In tests, use `@ts-expect-error` rather
  than casting.
- Per-pixel loops in `render/` are the hot path (called for every pixel of every tile). Keep them
  allocation-free and branch-light; existing code deliberately indexes flat typed arrays rather
  than building objects.
- Tests mock `geotiff` with `vi.mock` and hand-built fake image objects; there are no fixture
  `.tif` files in `test/`. Test layout mirrors `src/`.
- Public API changes need a `README.md` update, and breaking ones an entry in `MIGRATIONS.md`.