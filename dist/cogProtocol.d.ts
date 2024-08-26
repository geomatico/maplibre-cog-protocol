import { GetResourceResponse, RequestParameters } from 'maplibre-gl';
import { TileJSON } from './types';
export declare const TILE_SIZE = 256;
declare const cogProtocol: (params: RequestParameters) => Promise<GetResourceResponse<TileJSON | ImageBitmap>>;
export default cogProtocol;
