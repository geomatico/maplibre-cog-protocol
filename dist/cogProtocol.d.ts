import { RequestParameters } from 'maplibre-gl';
export interface FetchResponse {
    data: ImageBitmap;
    expires?: string;
    cacheControl?: string;
}
declare const cogProtocol: (params: RequestParameters, abortController: AbortController) => Promise<FetchResponse | {
    data: {
        tilejson: string;
        attribution: any;
        tiles: string[];
        maxzoom: number | undefined;
        bounds: [number, number, number, number];
        vector_layers: {
            id: string;
        }[];
    };
}>;
export default cogProtocol;
