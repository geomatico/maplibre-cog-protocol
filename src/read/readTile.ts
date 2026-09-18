import type {GeoTIFFImage, Pool} from 'geotiff';

import type {TypedArray} from '../types';

type ReadTileOptions = {
  window: [number, number, number, number];
  width: number;
  height: number;
  fillValue: number;
  pool: Pool;
};

type TypedArrayConstructor = {
  new (length: number): TypedArray;
  new (buffer: ArrayBufferLike): TypedArray;
};

// SampleFormat 1 (unsigned), 2 (signed) and 3 (float), by bit depth.
const ARRAY_TYPES: Record<number, Record<number, TypedArrayConstructor>> = {
  1: {8: Uint8Array, 16: Uint16Array, 32: Uint32Array},
  2: {8: Int8Array, 16: Int16Array, 32: Int32Array},
  3: {32: Float32Array, 64: Float64Array},
};

/**
 * The typed array a raster of this image can be read into, or undefined for the layouts that need
 * geotiff.js' own bit twiddling: exotic bit depths, mixed sample types, or big endian files with
 * more than one byte per sample.
 */
const arrayTypeFor = (image: GeoTIFFImage): TypedArrayConstructor | undefined => {
  const samples = image.getSamplesPerPixel();
  const bitsPerSample = image.getBitsPerSample(0);
  const sampleFormat = image.getSampleFormat(0);

  for (let sample = 1; sample < samples; sample++) {
    if (image.getBitsPerSample(sample) !== bitsPerSample || image.getSampleFormat(sample) !== sampleFormat) {
      return undefined;
    }
  }

  if (bitsPerSample > 8 && !image.littleEndian) return undefined; // host order is little endian

  return ARRAY_TYPES[sampleFormat]?.[bitsPerSample];
};

// Compressions whose decoder geotiff.js can build from public TIFF tags: no compression, LZW,
// JPEG, Deflate, PackBits, ZSTD, LERC and WebP. Each of the last three needs one extra tag or
// value, added in bindDecoder below; every other compression is left to readRasters.
const SUPPORTED_COMPRESSIONS = new Set([1, 5, 7, 8, 32773, 32946, 50000, 34887, 50001]);
const JPEG = 7;
const LERC = 34887;
const WEBP = 50001;

/**
 * The decoder geotiff.js would use for this image, bound to the worker pool. Beyond the predictor
 * pass, which geotiff.js runs inside the decoder, these parameters are not used, except for the
 * per-compression extras below: JPEG needs its shared Huffman tables, LERC its own header
 * parameters, and WebP how many of the 3 or 4 channels it decodes to keep.
 */
const bindDecoder = async (image: GeoTIFFImage, compression: number, predictor: number, pool: Pool) => {
  const extra =
    compression === JPEG
      ? {JPEGTables: await image.fileDirectory.loadValue('JPEGTables')}
      : compression === LERC
        ? {LercParameters: await image.fileDirectory.loadValue('LercParameters')}
        : compression === WEBP
          ? {samplesPerPixel: image.getSamplesPerPixel()}
          : {};

  return pool.bindParameters(compression, {
    tileWidth: image.getTileWidth(),
    tileHeight: image.getTileHeight(),
    planarConfiguration: image.planarConfiguration,
    bitsPerSample: (await image.fileDirectory.loadValue('BitsPerSample')) ?? image.getBitsPerSample(0),
    predictor,
    ...extra,
  });
};

/**
 * Maps every output index to the source index it samples, the way geotiff.js' nearest neighbour
 * resampling does: `windowStart + min(round(i * ratio), span - 1)`.
 */
const sourceIndexes = (windowStart: number, windowEnd: number, size: number): Int32Array => {
  const span = windowEnd - windowStart;
  const ratio = span / size;
  const indexes = new Int32Array(size);
  for (let i = 0; i < size; i++) {
    indexes[i] = windowStart + Math.min(Math.round(i * ratio), span - 1);
  }
  return indexes;
};

/**
 * Reads an interleaved raster for a pixel window, copying whole pixels between typed arrays.
 *
 * geotiff.js' own `readRasters` reads every sample of every pixel through a DataView call, which
 * for a COG with many bands costs more than decompressing the tile: 8.3 million calls, around
 * 200 ms, for a 256x256 window of a 127 band image, where the copy below takes about 3 ms.
 *
 * Returns undefined when the image is not laid out in a way this shortcut handles, leaving the
 * caller to fall back on `readRasters`.
 */
export const readTileFast = async (
  image: GeoTIFFImage,
  {window: [left, top, right, bottom], width, height, fillValue, pool}: ReadTileOptions,
): Promise<TypedArray | undefined> => {
  if (image.planarConfiguration !== 1) return undefined; // one block per band, not per pixel

  const compression = (await image.fileDirectory.loadValue('Compression')) ?? 1;
  const predictor = (await image.fileDirectory.loadValue('Predictor')) ?? 1;
  if (!SUPPORTED_COMPRESSIONS.has(compression)) return undefined;
  // A predictor is undone against the block geometry, which is only exact for a tiled image
  if (predictor !== 1 && !image.isTiled) return undefined;

  const ArrayType = arrayTypeFor(image);
  if (ArrayType === undefined) return undefined;

  const samples = image.getSamplesPerPixel();
  const imageWidth = image.getWidth();
  const imageHeight = image.getHeight();
  const blockWidth = image.getTileWidth();
  const blockHeight = image.getTileHeight();
  const blocksAcross = Math.ceil(imageWidth / blockWidth);

  // A COG written for the tiling scheme the map requests hands over whole blocks: the tile is one
  // block, at its own resolution, inside the image. The decoded block is already the raster, and
  // geotiff.js decodes into a fresh buffer (its tile cache is off), so it can be passed straight on.
  const isWholeBlock =
    width === blockWidth &&
    height === blockHeight &&
    right - left === blockWidth &&
    bottom - top === blockHeight &&
    left % blockWidth === 0 &&
    top % blockHeight === 0 &&
    left >= 0 &&
    top >= 0 &&
    right <= imageWidth &&
    bottom <= imageHeight;

  if (isWholeBlock) {
    const decoder = await bindDecoder(image, compression, predictor, pool);
    const block = await image.getTileOrStrip(left / blockWidth, top / blockHeight, 0, decoder);
    const values = new ArrayType(block.data);
    if (values.length === blockWidth * blockHeight * samples) return values;
  }

  const columns = sourceIndexes(left, right, width);
  const rows = sourceIndexes(top, bottom, height);

  // Which block each output column falls in, and where it starts inside a block row. Columns
  // outside the image are left out, so they keep the fillValue.
  const columnBlocks = new Int32Array(width).fill(-1);
  const columnOffsets = new Int32Array(width);
  for (let x = 0; x < width; x++) {
    const column = columns[x];
    if (column < 0 || column >= imageWidth) continue;
    columnBlocks[x] = Math.floor(column / blockWidth);
    columnOffsets[x] = (column % blockWidth) * samples;
  }

  // Output columns that are contiguous inside one block are copied in a single run per raster row,
  // which is most of them: a tile usually maps one to one onto the image it is read from.
  const runs: Array<{block: number; source: number; column: number; length: number}> = [];
  for (let x = 0; x < width; x++) {
    const block = columnBlocks[x];
    if (block === -1) continue;

    const previous = runs[runs.length - 1];
    const isContiguous =
      previous !== undefined &&
      previous.block === block &&
      previous.column + previous.length === x &&
      previous.source + previous.length * samples === columnOffsets[x];

    if (isContiguous) previous.length++;
    else runs.push({block, source: columnOffsets[x], column: x, length: 1});
  }

  // Decode the blocks the window touches. geotiff.js caches them, so neighbouring tiles reading
  // the same block only pay for it once, and the pool keeps the decoding off this thread.
  const blockColumns = new Set(Array.from(columnBlocks).filter((block) => block !== -1));
  const blockRows = new Set<number>();
  for (const row of rows) {
    if (row >= 0 && row < imageHeight) blockRows.add(Math.floor(row / blockHeight));
  }

  const decoder = await bindDecoder(image, compression, predictor, pool);
  const blockLength = blockWidth * blockHeight * samples;
  const blocks = new Map<number, TypedArray>();
  const decoded = await Promise.all(
    [...blockRows].flatMap((blockRow) =>
      [...blockColumns].map(async (blockColumn) => {
        const block = await image.getTileOrStrip(blockColumn, blockRow, 0, decoder);
        const values = new ArrayType(block.data);
        blocks.set(blockRow * blocksAcross + blockColumn, values);
        return values.length;
      }),
    ),
  );

  // A block of an unexpected size means the image is laid out in some way this shortcut has not
  // accounted for. Rather than assemble nonsense, hand the read back to geotiff.js.
  if (decoded.some((length) => length !== blockLength)) return undefined;

  const raster = new ArrayType(width * height * samples);
  if (fillValue) raster.fill(fillValue);

  for (let y = 0; y < height; y++) {
    const row = rows[y];
    if (row < 0 || row >= imageHeight) continue;

    const blockRow = Math.floor(row / blockHeight);
    const rowOffset = (row % blockHeight) * blockWidth * samples;
    const destinationRow = y * width * samples;

    for (const run of runs) {
      const block = blocks.get(blockRow * blocksAcross + run.block);
      const from = rowOffset + run.source;
      const values = run.length * samples;
      if (block === undefined || from + values > block.length) continue; // sparse or short block

      const destination = destinationRow + run.column * samples;
      if (values > 4) {
        raster.set(block.subarray(from, from + values), destination);
      } else {
        for (let i = 0; i < values; i++) raster[destination + i] = block[from + i];
      }
    }
  }

  return raster;
};
