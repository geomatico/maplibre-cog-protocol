# NoData and transparency in maplibre-cog-protocol

An analysis triggered by [issue #52](https://github.com/geomatico/maplibre-cog-protocol/issues/52)
(*"fromYCbCr: nodata check compares raw YCbCr bytes"*). It covers how "no data" and transparency
work today for every pixel type, colour interpretation and band count, what the standards and
existing tools do, and how the library should change.

All GDAL behaviour quoted here was reproduced locally with **GDAL 3.12.2** and **geotiff.js 3.0.5**
(the version in `package-lock.json`). Commands are listed in the [appendix](#appendix-a-reproductions).

---

## Contents

1. [TL;DR](#1-tldr)
2. [Three different concepts: nodata, mask and coverage](#2-three-different-concepts-nodata-mask-and-coverage)
3. [Pixel data types and sentinel values](#3-pixel-data-types-and-sentinel-values)
4. [Colour interpretations: which values does nodata refer to?](#4-colour-interpretations-which-values-does-nodata-refer-to)
5. [Single band vs multiband: ANY or ALL?](#5-single-band-vs-multiband-any-or-all)
6. [How the library behaves today](#6-how-the-library-behaves-today)
7. [How it should behave: proposed solutions](#7-how-it-should-behave-proposed-solutions)
8. [Implications for the code](#8-implications-for-the-code)
9. [Appendix A: reproductions](#appendix-a-reproductions) · [Appendix B: sources](#appendix-b-sources)

---

## 1. TL;DR

**Q1: With `NODATA=0` on a YCbCr (JPEG) COG, which pixels are nodata?**
Pixels whose **decoded RGB** value is `(0, 0, 0)`, **not** pixels whose raw Y, Cb and Cr bytes are
all 0. GDAL writes the nodata value against the bands it exposes to users. For a YCbCr JPEG TIFF,
those bands are **R, G, B**, because the YCbCr encoding is a storage detail. RGB black is stored as
YCbCr `(0, 128, 128)`, so the current check (`y === 0 && cb === 0 && cr === 0`) never matches.
Issue #52 is correct.

A related caveat: JPEG is lossy. Exact nodata equality on lossy data is fragile, because the
black edge around the image can decode to `(1, 0, 2)` and show up as an opaque dark fringe.
GDAL's answer is a lossless **internal mask band**, which GDAL writes automatically for JPEG COGs
unless you pass `ADD_ALPHA=NO`, and which this library already reads.

**Q2: When nodata is not declared, should 0 be transparent?**
**No.** No standard or major tool does that. With no nodata, GDAL, rasterio, QGIS and OpenLayers
all treat every pixel as valid. The `noData ?? 0` fallback in `renderPhoto` is non-standard, and
it hides a second problem. The library also uses the fill value to mark pixels **outside the image
extent**, and integer types have no spare value for that. Today, 0 happens to be both the fill
value and the default transparent value, which is why out-of-extent areas look right in photo
mode.

**Recommended fix (details in §7):**

1. Keep three concepts apart:
   - **nodata**: a sentinel in the file's sample values
   - **mask**: the file's own validity band
   - **coverage**: whether the pixel is inside the image at all
2. Compute **coverage geometrically** (a rectangle in tile pixels) and force alpha to 0 outside
   it. This works for every data type and doesn't need a sentinel.
3. Only treat nodata as transparent **when it is declared**. Compare it against the right values:
   - raw samples, before scale and offset
   - `Math.fround` for Float32 data
   - `isNaN` when nodata is NaN
   - decoded RGB for YCbCr
4. A multiband pixel is nodata only when **all** its bands match (GDAL, rasterio and OpenLayers
   agree; the current code already does this).
5. When the file has an internal **mask band, the mask wins** and nodata is ignored for
   transparency (GDAL's precedence).
6. Optionally, add a user-supplied nodata override for files that lack the metadata (as
   OpenLayers and QGIS do).

---

## 2. Three different concepts: nodata, mask and coverage

When a map shows a transparent pixel, there are three quite different reasons it could be
transparent. The current code mixes them together, and that is the root cause of most of the bugs
below.

### 2.1 NoData: a reserved value inside the data

A raster is a grid of numbers. **NoData** is a convention that says "one particular number doesn't
mean anything; treat it as a hole". A DEM might say `-9999`, a float raster `NaN`, and an RGB photo
`0`.

- **It is metadata about values, not about pixels.** The file doesn't store "this pixel is
  missing". It stores a normal number that you agree to interpret as missing.
- **It isn't in any formal standard.** TIFF 6.0 and OGC GeoTIFF 1.1 (both in this folder) have no
  concept of nodata. The de facto standard is GDAL's private ASCII tag **`GDAL_NODATA` (tag
  42113)**, and it holds **one value for all bands** of the image.
- **It refers to the sample values as GDAL exposes them**:
  - before any `SCALE`/`OFFSET` is applied (those are separate GDAL metadata)
  - after any storage-level colour-space conversion, such as YCbCr → RGB (see §4)
- **The sentinel takes up a real value.** If an 8-bit photo says nodata is 0, every truly black
  pixel is also considered nodata. That's the price of the convention.

### 2.2 Mask: an explicit "is this pixel valid?" layer

TIFF 6.0 *does* define transparency, in two ways:

| Mechanism                    | TIFF definition                                                                  | Semantics                                                 |
|------------------------------|----------------------------------------------------------------------------------|-----------------------------------------------------------|
| **Transparency mask subfile** | A separate IFD with `NewSubfileType` bit 2 set and `PhotometricInterpretation=4`, 1 bit/pixel | 1 = visible, 0 = transparent                              |
| **Alpha sample**             | An extra band described by `ExtraSamples` = 1 (associated/pre-multiplied) or 2 (unassociated) | Continuous opacity 0..max                                 |

GDAL calls both of these a *mask band* (RFC 15). A mask is **stored separately from the colour
values**, so it doesn't use up a real value, and (being 1-bit DEFLATE) **it survives lossy JPEG
compression exactly**. This makes it the most reliable of the three mechanisms.

GDAL's precedence rule (RFC 15, and confirmed with `gdalinfo`) is: an internal/external mask wins,
then nodata, then an alpha band, and otherwise everything is valid. `examples/data/image.tif`
declares **both** `NoData=0` and an internal mask, and `gdalinfo` reports `Mask Flags: PER_DATASET`.
In other words, GDAL uses the mask and **ignores nodata** for masking.

### 2.3 Coverage: is the pixel inside the image at all?

A map tile is a fixed square on the Web Mercator grid. The COG covers some arbitrary rectangle.
When a tile straddles the image border, part of the tile has **no source pixel at all**. Nothing
in the file describes these pixels, so neither nodata nor the mask apply. It's purely geometric.

Something similar happens with **sparse tiles**: TIFF blocks with `TileByteCounts = 0` that GDAL
omitted because they were empty (`SPARSE_OK=YES`). geotiff.js synthesises them by filling with
`GDAL_NODATA || 0`.

Coverage is the library's own problem. GDAL never needs to encode it because it reads within the
image bounds.

### 2.4 Three "spaces" a value can live in

To compare against nodata you have to be in the right space:

```
 raw sample (file)  ──photometric decode──▶  exposed band value  ──scale/offset──▶  physical value
 e.g. Y,Cb,Cr bytes                          e.g. R,G,B                            e.g. metres
                                   ▲
                                   └── GDAL_NODATA lives HERE
```

For most files the first arrow is the identity (the raw sample *is* the exposed value). The
exceptions are **YCbCr**, which GDAL always exposes as RGB, and to a lesser extent CIELab (see §4).

---

## 3. Pixel data types and sentinel values

geotiff.js returns one JavaScript `TypedArray` per tile. Its element type follows `BitsPerSample`
and `SampleFormat`. The type determines which sentinels can exist at all.

| TIFF type (GDAL)  | JS array       | Range                    | Has NaN / ±Inf? | Nodata values that can match | Typical nodata          |
|-------------------|----------------|--------------------------|-----------------|------------------------------|-------------------------|
| UInt8 (Byte)      | `Uint8Array`   | 0 … 255                  | **no**          | integers 0…255               | 0, 255                  |
| Int8              | `Int8Array`    | −128 … 127               | **no**          | integers −128…127            | −128                    |
| UInt16            | `Uint16Array`  | 0 … 65535                | **no**          | integers 0…65535             | 0, 65535                |
| Int16             | `Int16Array`   | −32768 … 32767           | **no**          | integers −32768…32767        | −32768, −9999           |
| UInt32 / Int32    | `Uint32Array` / `Int32Array` | 32-bit ints | **no**          | integers in range            | 0, −9999, −2147483648   |
| Float32           | `Float32Array` | ±3.4e38                  | yes             | `NaN`, ±Inf, and **values exactly representable in float32** | `NaN`, −9999, −3.4e38 |
| Float64           | `Float64Array` | ±1.8e308                 | yes             | `NaN`, ±Inf, any double      | `NaN`, −9999            |

### 3.1 Consequence 1: integer types have no spare value

Float rasters have values outside the "real number" domain: `NaN` and `Infinity`. You can use
them to mean "nothing here" without taking up a legitimate measurement. **Integer rasters don't.**
Every bit pattern of a `Uint8Array` is a legitimate colour. If a Byte file declares no nodata,
**there is no value you can write to mean "outside the image"** that couldn't also be a real pixel.

This is the fundamental reason why coverage (§2.3) can't be solved with a fill value for integer
data, and why the library currently needs its "0 is transparent" default to hide out-of-extent
pixels.

### 3.2 Consequence 2: JavaScript silently coerces what doesn't fit

Assigning a number to a typed array never throws. Measured in Node:

```
Uint8Array.from([Infinity, NaN, -9999, 256, -1, 3.7])  → [0, 0, 241, 0, 255, 3]
Int16Array.from([Infinity, -32769])                     → [0, 32767]
Float32Array.from([3.4e39, -9999.1, 1e-46])             → [Infinity, -9999.099609375, 0]
Math.fround(-9999.1) === -9999.1                        → false
```

These traps show up in the library:

- **`Infinity`/`NaN` become 0** in any integer array. The fill value `Infinity` (used when nodata
  is absent) is therefore really `0` for integer COGs.
- **Out-of-range integers wrap modulo 2ⁿ.** A Byte COG that (wrongly) declares nodata `-9999`
  gets out-of-extent pixels filled with **241**, which renders opaque.
- **Float32 rounds.** A Float32 COG with `GDAL_NODATA=-9999.1` stores `-9999.099609375` in every
  nodata pixel. `data[i] === -9999.1` is **false**. The comparison must be
  `data[i] === Math.fround(noData)` (GDAL does the equivalent: `GDALIsValueExactAs` plus a cast to
  the band type).
- **A nodata value that can't be represented never matches**, and that is the correct outcome.
  Examples are `-9999` on Byte and `3.5` on Int16. GDAL behaves the same way; `gdalwarp` even
  warns: *"destination nodata value has been rounded to 0, Byte being an integer datatype"*.

### 3.3 Consequence 3: parsing the tag

`GDAL_NODATA` is ASCII. geotiff.js parses it with `Number(str)`:

| Tag text          | `Number()` result | Correct?                                                        |
|-------------------|-------------------|-----------------------------------------------------------------|
| `"0"`, `"-9999"`  | 0, −9999          | yes                                                             |
| `"nan"`           | `NaN`             | yes, by accident (anything unparsable is NaN)                   |
| `"inf"`, `"-inf"` | `NaN`             | **no**: should be ±Infinity (GDAL writes these for ±Inf nodata) |
| `"-3.4028234663852886e+38"` | −3.4028…e38 | yes (and `Math.fround` keeps it equal to the float32 min)       |

The `inf` case is rare and belongs upstream (geotiff.js), but it's cheap to guard against locally.

### 3.4 NaN is special

`NaN !== NaN`, so a nodata value of `NaN` can never be detected with `===`. You have to use
`Number.isNaN`. Issue #50 was exactly this bug in `renderTerrain`.

Also, **a NaN sample is never meaningful to render**, even if the declared nodata is something
else or nothing at all. It can't be placed on a colour ramp or encoded as a height. QGIS treats NaN
in float rasters as nodata unconditionally. For the colour and DEM renderers this is the pragmatic
choice.

---

## 4. Colour interpretations: which values does nodata refer to?

`PhotometricInterpretation` (PI) says how to turn samples into colour. For each PI, the question
is: *which numbers is `GDAL_NODATA=v` compared against?* The answer is always "the band values
GDAL exposes". What changes is whether those are the raw samples.

| PI | Name          | Bands | What GDAL exposes                           | Nodata compared against          | Current library          |
|----|---------------|-------|---------------------------------------------|----------------------------------|--------------------------|
| 0  | WhiteIsZero   | 1     | raw sample                                  | raw sample                       | correct                  |
| 1  | BlackIsZero   | 1     | raw sample                                  | raw sample                       | correct                  |
| 2  | RGB           | 3(+)  | raw R, G, B                                 | raw R, G, B                      | correct                  |
| 3  | Palette       | 1     | raw **index** (colour table attached)       | the **index**, not the colour    | correct                  |
| 5  | CMYK          | 4     | raw C, M, Y, K                              | raw C, M, Y, K                   | correct                  |
| 6  | **YCbCr**     | 3     | **decoded R, G, B** (`SOURCE_COLOR_SPACE=YCbCr`) | **decoded R, G, B**         | **wrong** (compares raw Y, Cb, Cr) |
| 8  | CIELab        | 3     | raw L, a, b bytes                           | raw bytes                        | **inconsistent** (compares signed a*, b*) |

### 4.1 YCbCr in detail (issue #52)

YCbCr separates brightness (**Y**) from two colour-difference channels (**Cb**, **Cr**), centred
on **128**. It exists because JPEG compresses it much better than RGB (chroma can be subsampled).
The GDAL COG driver picks `PHOTOMETRIC=YCBCR` automatically for 3-band JPEG output. **It is a
storage encoding**: when reading, libtiff/GDAL convert back to RGB, and `gdalinfo` shows
`ColorInterp=Red/Green/Blue`.

geotiff.js does **not** convert. Its JPEG decoder returns raw component bytes, and `readRasters`
hands them to us as Y, Cb, Cr. This library's `rgba.fromYCbCr` converts them.

Reproduction: an RGB image with four quadrants, `nodata=0`, saved as COG JPEG, read back raw with
geotiff.js and decoded with GDAL:

| Original RGB    | Raw bytes in file (Y, Cb, Cr) | GDAL reads back (RGB) | GDAL nodata mask | Current lib |
|-----------------|-------------------------------|-----------------------|------------------|-------------|
| (0, 0, 0)       | **(0, 128, 128)**             | (0, 0, 0)             | nodata           | **opaque** (bug) |
| (0, 128, 128)   | (90, 151, 64)                 | (0, 128, **131**)     | valid            | opaque      |
| (10, 0, 0)      | (3, 126, 133)                 | (10, 0, 0)            | valid            | opaque      |
| (200, 100, 50)  | (124, 86, 182)                | (200, 100, 50)        | valid            | opaque      |

So the answer to "is it nodata if the raw value is 0 in every channel?" is **no**:

- The value GDAL wrote `0` against is RGB black, which is stored as `(0, 128, 128)`.
- Raw `(0, 0, 0)` in YCbCr decodes to `R = 0 + 1.402·(0−128) → 0`,
  `G = 0 − 0.344·(−128) − 0.714·(−128) → 135`, `B → 0`. That's **dark green**, not black. No
  encoder produces it for a black pixel.

**Two ways to fix the comparison:**

| Option | How | Pros | Cons |
|---|---|---|---|
| (a) Compare after decoding | Convert to RGB, clamp to 0..255 (already done by writing to the `Uint8ClampedArray`), then compare `rgba[i*4..i*4+2]` with nodata | Same semantics as GDAL. No extra maths: read back the three bytes just written. Tolerates rounding at the extremes (`(3,126,133)` → `(10,0,0)` exactly) | Rounding in the decoder (JS half-to-even vs libjpeg) can differ by ±1 from GDAL in rare mid-tones. Irrelevant for nodata 0 or 255 |
| (b) Convert nodata to YCbCr once | `nodata_YCbCr = rgbToYCbCr(v,v,v)` and compare raw | One conversion per tile | Only exact for grey nodata. Any JPEG drift of ±1 in Cb/Cr breaks it. Extra conversion code |

**Recommendation: (a).** It is simpler, matches GDAL, and is more robust.

### 4.2 The lossy compression caveat

Look at the second row above: `(0,128,128)` came back as `(0,128,131)`. JPEG moves values around,
especially at sharp edges, such as the border between an image and its black padding. Some
padding pixels will decode to `(1,0,0)` or `(0,2,1)`, won't equal nodata, and will draw a
**dark, ragged fringe**. No exact-equality rule can fix that.

Everyone treats this as an encoding problem, not a rendering problem:

- **GDAL's own solution is a mask.** When you `gdalwarp` to COG with `COMPRESS=JPEG` and don't pass
  `ADD_ALPHA=NO`, GDAL creates an alpha band and the COG driver *"converts it as a 1-bit DEFLATE
  compressed mask"*. `examples/data/image.tif` is built exactly like this, which is why the photo
  example looks right despite the #52 bug: the mask does all the work.
- The `nearblack` utility exists to clean up JPEG collars. Near-black tolerance is not something a
  renderer should guess.

The README's "RGB Image (lossy compression)" recipe currently uses
`-co ADD_ALPHA=NO -dstnodata NaN`. On a Byte image, `NaN` **is rounded to 0** (GDAL warns about
it), so it produces exactly the #52 file: nodata 0, no mask, JPEG fringes. The recipe should drop
`ADD_ALPHA=NO` (and `-dstnodata`) for JPEG so that GDAL writes a mask.

### 4.3 Palette

Nodata on a paletted image is a **colour table index**. Index 0 is often a real colour (the first
class of a land-cover map), which is why the existing `renderPhoto` test has to set `noData: 99` to
avoid the `?? 0` default. The comparison itself is correct. Only the default is harmful.

### 4.4 CIELab

`fromCIELab` converts a*/b* from unsigned bytes to signed int8 and then compares **the signed
values** with nodata. L is unsigned. GDAL exposes the raw bytes, so a nodata of `128` could match L
but never a* or b* (which become −128). For nodata 0 both agree, so in practice this is latent.
The fix is to compare the raw bytes `data[i*bands + k]`.

### 4.5 WhiteIsZero / BlackIsZero with floats

Grey renderers normalise by `2^BitsPerSample`, which makes little sense for floats (usually
rendered with `#color`). Out-of-extent `Infinity` becomes 255 (white, opaque) in BlackIsZero. This
is an edge case, but the coverage fix (§7.1) handles it for free.

---

## 5. Single band vs multiband: ANY or ALL?

`GDAL_NODATA` is a single value applied to each band **independently**. GDAL's per-band masks are
independent too: for RGB `(10, 0, 0)` with nodata 0, bands G and B are masked and band R is not
(verified). But a rendered pixel has a single alpha, so the per-band flags have to be combined.
There are two options:

- **ALL**: transparent only if *every* band equals nodata. `(10,0,0)` is visible.
- **ANY**: transparent if *some* band equals nodata. `(10,0,0)` disappears, and so does pure red
  `(255,0,0)`, pure yellow `(255,255,0)`, and so on.

What the industry does:

| Implementation | Rule | Evidence |
|---|---|---|
| GDAL warper (`gdalwarp`, default `UNIFIED_SRC_NODATA=PARTIAL`) | **ALL** | Docs: "if for a given pixel, it evaluates to the nodata value of each band, the target pixel is considered as globally invalid". Verified: alpha 0 for (0,0,0), 255 for (10,0,0) |
| GDAL `NODATA_VALUES` dataset metadata | **ALL** | "a pixel is considered nodata in all bands if and only if all bands match" |
| rasterio `dataset_mask()` / rio-tiler / TiTiler | **ALL** | "binary OR of the band masks" (valid if any band valid) |
| OpenLayers `ol/source/GeoTIFF` | **ALL** | Pixel starts transparent and becomes opaque as soon as one band differs from nodata |
| QGIS multiband colour renderer | **ANY** | `if ( redIsNoData \|\| greenIsNoData \|\| blueIsNoData )` |
| This library (`fromRGB`, `fromCMYK`, `fromYCbCr`, `fromCIELab`) | **ALL** | `&&` of all channels |

**Recommendation: keep ALL.** It is the choice of GDAL's dataset-level logic, the Python stack and
the closest web peer (OpenLayers). ANY damages legitimate saturated colours whenever nodata is 0 or
255. QGIS is the outlier, and its users regularly hit "my pure-red pixels are transparent".

For the **single-band renderers** (`#color`, `#dem`, grey, palette) only band 0 is read, so the
question doesn't arise. For **custom colour functions** the user sees every band and decides.

---

## 6. How the library behaves today

### 6.1 The request pipeline

```
cogProtocol.renderTile  (src/cogProtocol.ts)
 ├─ CogReader.getRawTile(z,x,y)                     src/read/CogReader.ts:105
 │    fillValue = noData ?? Infinity (NaN → Infinity)            :118
 │    readRasters({window, fillValue, resample nearest})         :145
 │      └─ geotiff.js: `if (fillValue) array.fill(fillValue)`   (skips 0, NaN)
 │      └─ geotiff.js sparse block: fill(GDAL_NODATA || 0)
 ├─ CogReader.getRawTile(..., {mask: true})         (null if no mask IFD)
 ├─ renderer  ─┬─ custom colour function  (raw samples + metadata; user decides)
 │             ├─ #dem   renderTerrain   px = offset + raw*scale; h = finite && px!==noData ? px : 0   :16
 │             ├─ #color renderColor     px = offset + raw*scale; px===noData || NaN || Inf → α 0  :18
 │             └─ photo  renderPhoto     transparentValue = noData ?? 0                            :23
 │                         └─ rgba.from*: α 0 when raw sample(s) === transparentValue (ALL bands)
 ├─ internal mask: rawMask[i] === 0 → α 0          src/cogProtocol.ts:83
 └─ GeoJSON mask (setMask)                          src/render/mask.ts
locationValues   px = offset + raw*scale; px===noData || NaN || Inf → NaN      src/read/locationValues.ts:23
```

The **fill value** is doing two jobs: representing nodata, and representing "outside the image".
The **`?? 0` default** makes the second job work for integer photos.

### 6.2 Behaviour matrix

"Inside" is a real pixel. "Outside" is a tile pixel beyond the image extent, which is filled via
`fillValue`.

**Integer data (Byte, UInt16, Int16, …)**

| Nodata declared | Region  | Raw value in tile | Photo (`renderPhoto`) | `#color` | `#dem` | `locationValues` |
|---|---|---|---|---|---|---|
| none | inside, value 0 | 0 | **transparent** ✗ (should be opaque black / palette[0]) | opaque colour(0) ✓ | 0 m ✓ | 0 ✓ |
| none | outside | **0** (Infinity→0) | transparent ✓ (by accident) | **opaque colour(0)** ✗ | 0 m ✓ | **0** ✗ (README promises NaN) |
| 0 | inside, value 0 | 0 | transparent ✓ (except YCbCr ✗) | transparent ✓ | 0 m ✓ | NaN ✓ |
| 0 | outside | 0 | transparent ✓ (YCbCr: raw 0,0,0 → ✓ by accident) | transparent ✓ | 0 m ✓ | NaN ✓ |
| 255 / 65535 / −9999 (in range) | outside | nodata | transparent ✓ | transparent ✓ | 0 m ✓ | NaN ✓ |
| −9999 on Byte (not representable) | outside | **241** | **opaque grey 241** ✗ | **opaque colour(241)** ✗ | 241 m ✗ | 241 ✗ |
| any, with `SCALE`≠1 or `OFFSET`≠0 | inside nodata | nodata | transparent ✓ | **opaque** ✗ (compares scaled value) | **encoded** ✗ | **scaled number** ✗ |

**Float data (Float32, Float64)**

| Nodata declared | Region | Raw value | Photo | `#color` | `#dem` | `locationValues` |
|---|---|---|---|---|---|---|
| none | inside, NaN | NaN | opaque ✗ (rare) | transparent ✓ | 0 m ✓ | NaN ✓ |
| none | outside | `Infinity` | inside value 0 → transparent ✗; Infinity → opaque white ✗ | transparent ✓ | 0 m ✓ | NaN ✓ |
| NaN | inside nodata | NaN | **opaque** ✗ (`NaN === NaN` is false) | transparent ✓ | 0 m ✓ | NaN ✓ |
| NaN | outside | `Infinity` | opaque ✗ | transparent ✓ | 0 m ✓ | NaN ✓ |
| −9999 (Float32 or Float64) | inside nodata | −9999 | transparent ✓ | transparent ✓ | 0 m ✓ | NaN ✓ |
| **−9999.1 on Float32** | inside nodata | −9999.0996… | **opaque** ✗ | **opaque colour** ✗ | **−9999 m** ✗ | **number** ✗ |

**Mask band present** (e.g. `examples/data/image.tif`: YCbCr JPEG, NoData=0, internal mask)

| Pixel | Mask | Nodata check today | Result today | GDAL |
|---|---|---|---|---|
| padding | 0 | raw (0,128,128) ≠ 0 → opaque | transparent (mask) ✓ | transparent |
| real black inside image | 255 | raw (0,128,128) ≠ 0 → opaque | opaque ✓ | opaque (mask wins) |
| real black inside, **after a naive #52 fix** | 255 | RGB (0,0,0) = 0 → transparent | **transparent** ✗ | opaque |

The last row matters: **fixing #52 alone would break the flagship photo example**, turning true
black pixels transparent, unless the mask-precedence rule (§7.4) comes with it.

### 6.3 Defect list

| # | Where | Defect | Severity |
|---|---|---|---|
| D1 | `src/render/rgba.ts:109` | YCbCr nodata compared on raw Y/Cb/Cr (issue #52). `test/render/rgba.spec.ts:110` asserts the current behaviour | High: every JPEG COG without a mask |
| D2 | `src/render/renderPhoto.ts:23` | `noData ?? 0`: undeclared nodata treated as 0. Black / palette index 0 disappears | High: silent data loss; non-standard |
| D3 | `src/read/CogReader.ts:118` | Coverage encoded as a fill value. For integer types it is 0 (Infinity coerced) or wrapped (241). Only works thanks to D2 | High: blocks fixing D1 and D2 |
| D4 | `src/render/renderColor.ts:18`, `renderTerrain.ts:16`, `read/locationValues.ts:23` | Nodata compared **after** scale/offset (GDAL nodata is raw). The README custom-function examples compare raw, which is inconsistent | Medium: any COG with SCALE/OFFSET |
| D5 | all `===` comparisons | Float32 nodata not passed through `Math.fround` | Medium: non-representable decimal nodata |
| D6 | `src/render/rgba.ts` grey/palette/RGB/CMYK | NaN nodata never matches (`===`) in photo mode | Low: floats rarely rendered as photo |
| D7 | `src/render/rgba.ts:151` | CIELab compares signed a*/b* | Low: latent unless nodata ≥ 128 |
| D8 | `src/cogProtocol.ts:83` + renderers | Mask and nodata are both applied (combined). GDAL gives the mask precedence | Medium: surfaces once D1 is fixed |
| D9 | geotiff.js `getGDALNoData` | `"inf"`/`"-inf"` parse as NaN | Low |
| D10 | `README.md:177-181, 552, 558` | Recommends `ADD_ALPHA=NO -dstnodata NaN` for JPEG and Byte. With `TILING_SCHEME` the value is dropped altogether (§7.5), so the file ends up with neither nodata nor mask | Medium: steers users towards D1/D2 |
| D11 | `test/read/locationValues.spec.ts:78` | `new Uint8Array(…).fill(Infinity)` is all zeros; the test doesn't test what its name says | Low |

---

## 7. How it should behave: proposed solutions

The target model, stated once:

> A rendered pixel is **transparent** if **any** of these is true:
> 1. it is **outside the image coverage**;
> 2. the file has an **internal mask** and the mask is 0;
> 3. the file has **no mask**, a nodata value **is declared**, and **all** exposed band values equal
>    it (compared in raw/exposed space, type-exactly);
> 4. *(float data, `#color` / `#dem` only)* the value is **NaN** or non-finite.
>
> Otherwise it is opaque. An undeclared nodata means "no nodata".

Each part is discussed below, with the alternatives.

### 7.1 Coverage: stop using fill values to mean "outside"

**Option A: a geometric coverage rectangle (recommended).**
`getRawTile` already computes the pixel window `[x0, y0, x1, y1]` in the chosen overview
(`tileIndexToPixelWindow`, `src/read/math.ts`), and it knows the overview's width and height. With
nearest resampling, geotiff.js maps output column `c` to source column
`x0 + min(round(c · (x1−x0)/256), (x1−x0)−1)` (see `resampleNearest`). A column is covered iff that
source column lies in `[0, width)`, and likewise for rows. The covered area is therefore an
axis-aligned rectangle `[cMin, cMax) × [rMin, rMax)` in tile pixels, found with four divisions per
tile, not per pixel.

- The reader returns (or exposes via a small helper) that rectangle alongside the tile, and
  `renderTile` sets α=0 outside it, exactly as it already does for `rawMask`.
- In the very common "tile fully inside the image" case the rectangle is `[0,256)²` and costs
  nothing.
- **Works for every data type** and needs no sentinel. D3 disappears.
- The fill value can then be anything harmless: keep `noData` when representable (so custom
  functions and `#dem` keep seeing nodata outside), otherwise 0.
- Cached tiles would need to cache the rectangle too, or it can be recomputed cheaply from
  metadata.

**Option B: keep fill values, fix them per type.**
Use `NaN` for floats (after patching around geotiff.js's `if (fillValue)`, e.g. by filling the
result ourselves) and nodata for integers. **This can't work for integer data without declared
nodata**, which is exactly the D2 case, and it keeps two concerns mixed. Not recommended.

**Option C: a coverage bitmap per tile.** A `Uint8Array(65536)` like the mask. Fully general
(handles rotated or sheared images, which the library doesn't support anyway), but it allocates per
tile. It is only worth considering if non-axis-aligned sources ever appear.

**What should each consumer see outside coverage?**

| Consumer | Proposal |
|---|---|
| Photo / `#color` | α = 0 (via rectangle) |
| `#dem` | height 0 (keeps the #50 decision: consistent with MapLibre's "no DEM tile" = 0 m) |
| Custom colour function | Still called; α forced to 0 afterwards, as the internal mask does today. Documented |
| `locationValues` | Check the rectangle (or image bounds) **before** reading. Return `NaN` for every band, as the README already promises |

### 7.2 NoData comparison: one correct predicate, built once per tile

Resolve the kind of comparison **outside** the per-pixel loop so the hot path stays branch-light
(AGENTS.md: *"keep them allocation-free and branch-light"*):

```ts
// Sketch, not final code.
type NoDataTest = ((v: number) => boolean) | null;

const noDataTest = (noData: number | undefined, data: TypedArray): NoDataTest => {
  if (noData === undefined) return null;                      // undeclared → never nodata
  if (Number.isNaN(noData)) return (v) => v !== v;            // NaN
  const target = data instanceof Float32Array ? Math.fround(noData) : noData;
  return (v) => v === target;                                 // unrepresentable integers simply never match
};
```

For the multiband photo renderers a closure call per channel may be too slow. The fast
alternative is two loop variants, one with and one without the nodata check, plus a precomputed
`target` and an `isNaNTarget` flag. Either way:

- **Raw space, before scale/offset** everywhere (`#color`, `#dem`, `locationValues`, photo). The
  scaled value is computed only for pixels that pass. Fixes D4.
- **Float32 exactness** via `Math.fround`. Fixes D5.
- **NaN nodata** via `v !== v`. Fixes D6.
- **YCbCr**: decode first, then test the three bytes just written to `rgba` (§4.1 option a).
  Fixes D1.
- **CIELab**: test the raw bytes, not the signed a*/b*. Fixes D7.
- **NaN / ±Infinity samples in floats** (independent of nodata) stay invalid for `#color` and
  `#dem`, as today. Photo grey renderers can adopt the same rule cheaply.
- **Parsing**: map `"inf"`/`"-inf"` strings to ±Infinity when reading metadata (read the raw tag
  instead of `getGDALNoData`, or post-process a NaN result by checking the tag text). Fixes D9.

### 7.3 When nodata is not declared

Once coverage is handled geometrically, the `?? 0` default no longer has a technical reason to
exist. Two equally defensible designs:

| | **Option A: strict (GDAL semantics)** | **Option B: strict + user override** |
|---|---|---|
| Undeclared nodata | No nodata. Every pixel inside coverage is opaque | Same by default |
| User remedy | Fix the file: `gdal_edit.py -a_nodata 0 file.tif`, or regenerate with a mask | Fix the file, **or** declare it at runtime, e.g. `setNoData(url, 0)` or a hash modifier `#…,nodata=0` |
| Precedent | GDAL, rasterio, TiTiler | OpenLayers (`sources[].nodata`), QGIS ("Additional no data value"), MapServer (`OFFSITE`) |
| API change | none (behaviour change only) | new public API → README |
| Handles files you can't modify (third-party COGs) | no | yes |
| Risk | users relying on the implicit 0 see black borders after upgrading | same, but with a one-line fix |

Both remove the silent data loss. **Recommendation:** ship **A** together with the fixes (it's the
correct baseline and required anyway), and add **B** when it's needed, following the existing
URL-keyed pattern of `setColorFunction` (`src/render/custom/rendererStore.ts`). Either way it is a
**behaviour-breaking change**. It needs a `MIGRATIONS.md` entry explaining how to get the old
look (`gdal_edit -a_nodata 0`, or the override), and the README note at lines 177-181 has to be
rewritten.

A third option, *keep defaulting to 0 but only for Byte RGB*, was considered and rejected. It is
still a guess, it still erases real black, and it contradicts every reference implementation.

### 7.4 Mask vs nodata precedence

| | **Option A: mask wins (GDAL)** | **Option B: combine (OpenLayers)** |
|---|---|---|
| Rule | If a mask IFD exists, use only the mask; ignore nodata for transparency | Transparent if mask = 0 **or** nodata matches |
| `image.tif` real black pixels after the #52 fix | opaque ✓ | **transparent** ✗ |
| File with a stale or partial mask *and* correct nodata | trusts the mask | hides both |
| Cost | Skip the nodata test when `rawMask` exists (cheaper) | Both tests |
| Precedent | GDAL RFC 15 / GTiff, rasterio `dataset_mask`, TiTiler | OpenLayers |

**Recommendation: A.** It is what the tool that wrote the file intends: GDAL wrote a mask precisely
because nodata is unreliable on JPEG. It also avoids the regression in §6.2.

Implementation note: renderers currently don't know whether a mask exists, because the mask is
applied after them in `renderTile`. Either pass `noData: undefined` to the renderer when `rawMask`
is non-null, or pass a flag. The first needs no renderer change.

**Alpha bands (`ExtraSamples`)** were ignored when this report was written. They are now read, as
the last link of the chain (mask → nodata → alpha), matching GDAL's `GMF_ALPHA` precedence. Unlike
the other two, alpha carries partial transparency, so it multiplies the alpha the renderer
produced instead of being a yes/no test; associated (premultiplied) alpha has its colors restored.
With JPEG, GDAL turns alpha into a mask anyway, so this mostly matters for lossless COGs.

### 7.5 Recommended GDAL recipes (README)

| Data | Recipe | Why |
|---|---|---|
| RGB, lossy (JPEG) | `gdalwarp … -of COG -co COMPRESS=JPEG -co TILING_SCHEME=GoogleMapsCompatible` **without** `ADD_ALPHA=NO` and **without** `-dstnodata` | GDAL adds alpha → converted to a lossless 1-bit mask. No fringes, true black preserved |
| RGB, lossless | as above with `COMPRESS=DEFLATE`/`ZSTD` and `ADD_ALPHA=NO`, with noData **declared on the source** (accept losing true black), or keep alpha and wait for alpha support | nodata is exact with lossless compression |
| Float DEM / continuous data | noData `NaN` on the source (Float32/64) | NaN can't collide with real values |
| Integer continuous data | noData set to a value outside the real range (e.g. `-32768` for Int16) | integers have no spare value (§3.1) |

Two GDAL traps found while testing these, both of which bite the recipes the README used to give
(D10):

- **`-dstnodata` is silently dropped when the COG driver reprojects.** With
  `-co TILING_SCHEME=GoogleMapsCompatible`, `gdalwarp … -of COG … -dstnodata 0` produces a file
  with no `GDAL_NODATA` tag at all (GDAL 3.12.2, verified on both Byte and Float32 sources). With
  `ADD_ALPHA=NO` the result has neither nodata nor mask, i.e. no transparency whatsoever. The value
  has to be declared on the source (`gdal_edit.py -a_nodata`) or written in a second step
  (`gdal_translate -of COG -a_nodata`).
- **`-dstnodata NaN` on an integer type is rounded to 0**, with a warning
  (*"destination nodata value has been rounded to 0, Byte being an integer datatype"*).

Together, these mean a COG built with the old README recipe has no nodata and no mask, and only
looked right because of the `?? 0` default (D2). Those are the files that change appearance.

One more, for repairing an existing COG: `gdal_edit.py -a_nodata` needs
`-oo IGNORE_COG_LAYOUT_BREAK=YES` and then rewrites the IFD at the end of the file, after which the
validator reports `KNOWN_INCOMPATIBLE_EDITION=YES` — it is no longer a valid COG. Writing a new
file with `gdal_translate … -of COG -a_nodata 0` keeps the layout (at the cost of re-encoding).

---

## 8. Implications for the code

### 8.1 Files touched

| File | Change |
|---|---|
| `src/read/math.ts` | New helper: tile-pixel coverage rectangle from window + overview size (mirrors `resampleNearest` rounding) |
| `src/read/CogReader.ts` | Expose coverage (return it with the tile, or a `getCoverage(tileIndex)` reusing the same image selection). Fill value: `noData` if representable in the band type, else 0. Parse `inf` nodata |
| `src/cogProtocol.ts` | Apply coverage α = 0 next to the `rawMask` loop. Pass `noData: undefined` to renderers when a mask exists (§7.4) |
| `src/render/renderPhoto.ts` | Remove `?? 0`. Pass `undefined` through |
| `src/render/rgba.ts` | Nodata test built once per tile; loop variants with and without the test; YCbCr compares the decoded bytes; CIELab compares the raw bytes; `fround`/NaN handling |
| `src/render/renderColor.ts`, `renderTerrain.ts` | Test nodata on the raw sample, then scale |
| `src/read/locationValues.ts` | Raw-space test; NaN outside the image bounds |
| `src/types.ts` | `CogMetadata.noData` stays `number \| undefined` (already correct). Possibly a `Coverage` type |
| `README.md`, `MIGRATIONS.md` | Transparency section, GDAL recipes, breaking-change entry |

### 8.2 Hot-path considerations

- The per-pixel cost must not grow for the common case (tile fully inside, no nodata or a mask).
  Hoisting the "is there a nodata test" decision out of the loop achieves that. The loops actually
  get *cheaper* when nodata is undefined or a mask exists.
- `Math.fround` is computed **once** per tile, not per pixel.
- `instanceof Float32Array` is checked once per tile. It is proper narrowing, with no `as` casts
  (project convention).
- The YCbCr change doesn't add maths: it reads back `rgba[i*4]`, `rgba[i*4+1]` and `rgba[i*4+2]`
  after writing them.
- The coverage rectangle is applied by two nested ranges over rows and columns outside the
  rectangle. In the full-coverage case it's a no-op.

### 8.3 Tests that change or are added

- `test/render/rgba.spec.ts:109-112`: invert. `(0,128,128)` with nodata 0 must be **transparent**,
  and raw `(0,0,0)` must be **opaque** (it's green).
- `test/render/rgba.spec.ts` grey, palette and RGB tests using `transparentValue`: add
  "undefined nodata → always opaque" cases.
- `test/render/renderPhoto.spec.ts:51-57`: the `noData: 99` workaround becomes unnecessary.
- `test/read/CogReader.spec.ts:284-313`: the fill-value expectations change; add coverage
  rectangle tests (fully inside, straddling each edge, fully outside, non-integer windows).
- `test/read/locationValues.spec.ts:78`: replace the `Uint8Array.fill(Infinity)` with a real
  out-of-bounds case.
- New: Float32 nodata `-9999.1`; NaN nodata in photo mode; scale/offset with nodata in `#color`,
  `#dem` and `locationValues`; mask present + nodata declared → nodata ignored.
- Manual check (AGENTS.md: the examples are the real test bed): `examples/photo.html` with
  `image.tif`; a JPEG COG **without** a mask built with the current README recipe; a
  non-GoogleMapsCompatible COG whose edges fall mid-tile.

### 8.4 Suggested delivery

1. **Coverage rectangle** (D3, D11). Photo tiles look the same, because the `?? 0` default already
   hid uncovered pixels, but `#color` tiles stop painting the area outside the COG and
   `locationValues` returns NaN there. It makes the rest safe. **Done.**
2. **Nodata predicate** (D1, D4, D5, D6, D7, D9) + **mask precedence** (D8). Closes #52 without
   regressing `image.tif`. **Done**, with one caveat: the `?? 0` default of D2 is still in
   `renderPhoto`, and it would cancel out the mask precedence, so it now applies only when the COG
   has no mask band (a `hasMask` option that step 3 removes along with the default itself).
3. **Remove the `?? 0` default** (D2) + README/MIGRATIONS + recipes (D10). Breaking: release as a
   minor bump with migration notes (pre-1.0). **Done**, documented as 0.9.x → 0.10.0.
4. *(Optional)* user nodata override (§7.3 B) and alpha-band support (§7.4). **Alpha done**, along
   with `locationValues` honouring the mask band, the alpha sample and the GeoJSON mask. The user
   nodata override was deliberately left out.

---

## Appendix A: reproductions

All run in a scratch directory with GDAL 3.12.2 Python bindings and the project's geotiff.js.

**Build test COGs** (512×512, EPSG:3857, four quadrants, nodata 0):

```python
from osgeo import gdal, osr
import numpy as np
a = np.zeros((3, 512, 512), np.uint8)
a[:, :256, 256:] = np.array([0, 128, 128]).reshape(3, 1, 1)
a[:, 256:, :256] = np.array([10, 0, 0]).reshape(3, 1, 1)
a[:, 256:, 256:] = np.array([200, 100, 50]).reshape(3, 1, 1)
ds = gdal.GetDriverByName('MEM').Create('', 512, 512, 3, gdal.GDT_Byte)
ds.SetGeoTransform([0, 10, 0, 0, 0, -10])
sr = osr.SpatialReference(); sr.ImportFromEPSG(3857); ds.SetProjection(sr.ExportToWkt())
for i in range(3):
    ds.GetRasterBand(i + 1).WriteArray(a[i]); ds.GetRasterBand(i + 1).SetNoDataValue(0)
gdal.Translate('ycbcr.tif', ds, format='COG', creationOptions=['COMPRESS=JPEG', 'BLOCKSIZE=256'])
gdal.Translate('deflate.tif', ds, format='COG', creationOptions=['COMPRESS=DEFLATE', 'BLOCKSIZE=256'])
```

`gdal.Open('ycbcr.tif')` reports `SOURCE_COLOR_SPACE=YCbCr`, bands `Red/Green/Blue`, NoData 0,
mask flags `GMF_NODATA` (per band). Band values at the four quadrants: `(0,0,0)`, `(0,128,131)`,
`(10,0,0)`, `(200,100,50)`.

**Raw samples as geotiff.js sees them:**

```js
import {fromFile} from 'geotiff';
const image = await (await fromFile('ycbcr.tif')).getImage();
const d = await image.readRasters({interleave: true});
// PhotometricInterpretation 6, getGDALNoData() 0
// (10,10) → [0,128,128]  (10,300) → [90,151,64]  (300,10) → [3,126,133]  (300,300) → [124,86,182]
```

**Multiband rule in the warper:**

```sh
gdalwarp deflate.tif w.tif -srcnodata 0 -dstalpha                          # default (PARTIAL)
#   (0,0,0) → α 0   (0,128,128) → α 255   (10,0,0) → α 255
gdalwarp deflate.tif w.tif -srcnodata 0 -dstalpha -wo UNIFIED_SRC_NODATA=NO
#   (0,0,0) → α 255 (per-band only, alpha never 0)
```

**NaN nodata on Byte:**

```sh
gdalwarp deflate.tif warpnan.tif -dstnodata NaN
# Warning 1: for band 1, destination nodata value has been rounded to 0, Byte being an integer datatype.
```

**JPEG COG keeps alpha as a mask:**

```sh
gdalwarp deflate.tif cogw.tif -of COG -co COMPRESS=JPEG -co TILING_SCHEME=GoogleMapsCompatible
gdalinfo cogw.tif   # Mask Flags: PER_DATASET, overviews of mask band; no NoData
gdalinfo examples/data/image.tif   # NoData Value=0 AND Mask Flags: PER_DATASET  → mask wins
```

**Typed-array coercion (Node):** see §3.2.

## Appendix B: sources

- TIFF Revision 6.0 (`doc/TIFF6.pdf`): `ExtraSamples`, `NewSubfileType`, transparency mask. No
  nodata concept.
- OGC GeoTIFF Standard 1.1 (`doc/OGC GeoTIFF Standard.pdf`): no nodata concept.
- GDAL GTiff driver: <https://gdal.org/en/stable/drivers/raster/gtiff.html> (`GDAL_NODATA` tag
  42113, *"all bands must use the same nodata value"*; internal masks).
- GDAL COG driver: <https://gdal.org/en/stable/drivers/raster/cog.html> (`ADD_ALPHA`, alpha → 1-bit
  mask with JPEG, automatic YCbCr).
- GDAL RFC 15, band masks: <https://gdal.org/en/stable/development/rfc/rfc15_nodatabitmask.html>.
- GDAL raster data model (`NODATA_VALUES`): <https://gdal.org/en/stable/user/raster_data_model.html>.
- GDAL warper options (`UNIFIED_SRC_NODATA`): <https://gdal.org/en/stable/api/gdalwarp_cpp.html>.
- rasterio masks: <https://rasterio.readthedocs.io/en/stable/topics/masks.html>.
- QGIS `src/core/raster/qgsmultibandcolorrenderer.cpp` (ANY rule).
- OpenLayers `src/ol/source/GeoTIFF.js` (ALL rule, mask combined, user `nodata` option).
- geotiff.js 3.0.5 `dist-module/geotiffimage.js` (`getGDALNoData`, `readRasters` fill value, sparse
  blocks), `compression/jpeg.js` (no colour conversion), `resample.js` (`resampleNearest`).
- Issues [#50](https://github.com/geomatico/maplibre-cog-protocol/issues/50) (NaN nodata in
  terrain) and [#52](https://github.com/geomatico/maplibre-cog-protocol/issues/52) (YCbCr).
