import { fromUrl, Pool } from 'geotiff';
import QuickLRU from 'quick-lru';
import { mercatorBboxToGeographicBbox, tileIndexToPixelWindow, zoomFromResolution } from './math';
const ONE_HOUR_IN_MILLISECONDS = 60 * 60 * 1000;
let pool;
let requestHeaders;
const geoTiffCache = new QuickLRU({ maxSize: 16, maxAge: ONE_HOUR_IN_MILLISECONDS });
const metadataCache = new QuickLRU({ maxSize: 16, maxAge: ONE_HOUR_IN_MILLISECONDS });
const tileCache = new QuickLRU({ maxSize: 1024, maxAge: ONE_HOUR_IN_MILLISECONDS });
const CogReader = (url) => {
    if (pool === undefined) {
        pool = new Pool();
    }
    const getGeoTiff = (url) => {
        const cachedGeoTiff = geoTiffCache.get(url);
        if (cachedGeoTiff) {
            return cachedGeoTiff;
        }
        else {
            const geoTiff = fromUrl(url, requestHeaders ? { headers: requestHeaders } : undefined);
            geoTiffCache.set(url, geoTiff);
            return geoTiff;
        }
    };
    const getMetadata = async () => {
        const cachedMetadata = metadataCache.get(url);
        if (cachedMetadata) {
            return cachedMetadata;
        }
        else {
            const tiff = await getGeoTiff(url);
            const firstImage = await tiff.getImage();
            const projectedCSType = firstImage.getGeoKeys()?.ProjectedCSTypeGeoKey;
            if (projectedCSType !== undefined && projectedCSType !== 3857 && projectedCSType !== 102113) {
                throw new Error(`COG projection EPSG:${projectedCSType} in ${url} is not supported. Reproject to EPSG:3857 (Web Mercator).`);
            }
            const gdalMetadata = await firstImage.getGDALMetadata(0); // Metadata for first image and first sample
            const fileDirectory = firstImage.fileDirectory;
            const artist = await fileDirectory?.loadValue('Artist');
            const rawBitsPerSample = await fileDirectory?.loadValue('BitsPerSample');
            const rawColorMap = await fileDirectory?.loadValue('ColorMap');
            const bbox = mercatorBboxToGeographicBbox(firstImage.getBoundingBox());
            const imagesMetadata = [];
            const imageCount = await tiff.getImageCount();
            for (let index = 0; index < imageCount; index++) {
                const image = await tiff.getImage(index);
                const newSubFileType = (await image.fileDirectory.loadValue('NewSubfileType')) ?? 0;
                const zoom = zoomFromResolution(image.getResolution(firstImage)[0]);
                const isOverview = !!(newSubFileType & 1);
                const isMask = !!(newSubFileType & 4);
                imagesMetadata.push({ zoom, isOverview, isMask });
            }
            const metadata = {
                offset: gdalMetadata && typeof gdalMetadata.OFFSET === 'string' ? parseFloat(gdalMetadata.OFFSET) : 0.0,
                scale: gdalMetadata && typeof gdalMetadata.SCALE === 'string' ? parseFloat(gdalMetadata.SCALE) : 1.0,
                noData: firstImage.getGDALNoData() ?? undefined,
                photometricInterpretation: await fileDirectory?.loadValue('PhotometricInterpretation'),
                bitsPerSample: rawBitsPerSample ? Array.from(rawBitsPerSample) : undefined,
                colorMap: rawColorMap ? Array.from(rawColorMap) : undefined,
                artist: artist,
                bbox: bbox,
                images: imagesMetadata,
            };
            // @ts-expect-error metadata will be wrapped with a Promise
            metadataCache.set(url, metadata);
            return metadata;
        }
    };
    const getTilejson = async (fullUrl) => {
        const { artist, images, bbox } = await getMetadata();
        const zooms = images.map((image) => image.zoom);
        return {
            tilejson: '2.2.0',
            tiles: [`${fullUrl}/{z}/{x}/{y}`],
            attribution: artist,
            minzoom: 0,
            maxzoom: Math.round(Math.max(...zooms)),
            bounds: bbox,
        };
    };
    async function getRawTile({ z, x, y }, { mask = false, tileSize = 256 } = {}) {
        const cacheKey = `${url}/${mask ? 'mask/' : 'image/'}${tileSize}/${z}/${x}/${y}`;
        const cachedTile = tileCache.get(cacheKey);
        if (cachedTile !== undefined)
            return cachedTile;
        const { noData, images } = await getMetadata();
        // FillValue won't accept NaN.
        // Infinity will work for Float32Array and Float64Array.
        // Int and Uint arrays will be filled with zeroes.
        const fillValue = mask ? 0 : noData === undefined || Number.isNaN(noData) ? Infinity : noData;
        // Filter data or mask images
        const filteredImages = images
            .map((img, index) => ({ ...img, index }))
            .filter((img) => (mask ? img.isMask : !img.isMask));
        if (filteredImages.length === 0)
            return null; // only reachable when mask=true and COG has no mask band
        // Pick the closest image to z.
        const aboveZoomImages = filteredImages.filter((img) => Math.round(img.zoom) >= z);
        const bestImage = aboveZoomImages.length > 0
            ? aboveZoomImages.reduce((a, b) => (a.zoom < b.zoom ? a : b)) // Closest above z
            : filteredImages.reduce((a, b) => (a.zoom > b.zoom ? a : b)); // Closest below z (fallback)
        const tiff = await getGeoTiff(url);
        const firstImage = await tiff.getImage(0);
        const selectedImage = await tiff.getImage(bestImage.index);
        const window = tileIndexToPixelWindow({ x, y, z }, firstImage.getBoundingBox(), selectedImage.getWidth(), selectedImage.getHeight());
        const tile = selectedImage.readRasters({
            window: window,
            width: tileSize,
            height: tileSize,
            interleave: true,
            resampleMethod: 'nearest',
            pool,
            fillValue,
        }); // interleaved ReadRasterResult is always a single TypedArray
        tileCache.set(cacheKey, tile);
        return tile;
    }
    return { getTilejson, getMetadata, getRawTile };
};
export const getCogMetadata = (url) => CogReader(url).getMetadata();
export const setRequestHeaders = (headers) => {
    requestHeaders = headers;
};
export default CogReader;
