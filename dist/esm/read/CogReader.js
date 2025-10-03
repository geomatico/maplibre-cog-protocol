import { fromUrl, Pool } from 'geotiff';
import QuickLRU from 'quick-lru';
import { mercatorBboxToGeographicBbox, tileIndexToMercatorBbox, zoomFromResolution } from './math';
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
            const gdalMetadata = firstImage.getGDALMetadata(0); // Metadata for first image and first sample
            const fileDirectory = firstImage.fileDirectory;
            const artist = firstImage.fileDirectory?.Artist;
            const bbox = mercatorBboxToGeographicBbox(firstImage.getBoundingBox());
            const imagesMetadata = [];
            const imageCount = await tiff.getImageCount();
            for (let index = 0; index < imageCount; index++) {
                const image = await tiff.getImage(index);
                const zoom = zoomFromResolution(image.getResolution(firstImage)[0]);
                const isOverview = !!(image.fileDirectory.NewSubfileType & 1);
                const isMask = !!(image.fileDirectory.NewSubfileType & 4);
                imagesMetadata.push({ zoom, isOverview, isMask });
            }
            const metadata = {
                offset: gdalMetadata?.OFFSET !== undefined ? parseFloat(gdalMetadata.OFFSET) : 0.0,
                scale: gdalMetadata?.SCALE !== undefined ? parseFloat(gdalMetadata.SCALE) : 1.0,
                noData: firstImage.getGDALNoData() ?? undefined,
                photometricInterpretation: fileDirectory?.PhotometricInterpretation,
                bitsPerSample: fileDirectory?.BitsPerSample,
                colorMap: fileDirectory?.ColorMap,
                artist: artist,
                bbox: bbox,
                images: imagesMetadata
            };
            // @ts-expect-error metadata will be wrapped with a Promise
            metadataCache.set(url, metadata);
            return metadata;
        }
    };
    const getTilejson = async (fullUrl) => {
        const { artist, images, bbox } = await getMetadata();
        const zooms = images.map(image => image.zoom);
        return {
            tilejson: '2.2.0',
            tiles: [fullUrl + '/{z}/{x}/{y}'],
            attribution: artist,
            minzoom: Math.round(Math.min(...zooms)),
            maxzoom: Math.round(Math.max(...zooms)),
            bounds: bbox
        };
    };
    const getRawTile = async ({ z, x, y }, tileSize = 256) => {
        const key = `${url}/${tileSize}/${z}/${x}/${y}`;
        const cachedTile = tileCache.get(key);
        if (cachedTile) {
            return cachedTile;
        }
        else {
            const tiff = await getGeoTiff(url);
            const { noData } = await getMetadata();
            // FillValue won't accept NaN.
            // Infinity will work for Float32Array and Float64Array.
            // Int and Uint arrays will be filled with zeroes.
            const fillValue = noData === undefined || isNaN(noData) ? Infinity : noData;
            const tile = tiff.readRasters({
                bbox: tileIndexToMercatorBbox({ x, y, z }),
                width: tileSize,
                height: tileSize,
                interleave: true,
                resampleMethod: 'nearest',
                pool,
                fillValue // When fillValue is Infinity, integer types will be filled with a 0 value.
            }); // ReadRasterResult extends TypedArray
            tileCache.set(key, tile);
            return tile;
        }
    };
    return { getTilejson, getMetadata, getRawTile };
};
export const getCogMetadata = (url) => CogReader(url).getMetadata();
export const setRequestHeaders = (headers) => {
    requestHeaders = headers;
};
export default CogReader;
