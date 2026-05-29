import type { GetResourceResponse, RequestParameters } from 'maplibre-gl';
import type { TileJSON } from './types';
declare const cogProtocol: (params: RequestParameters) => Promise<GetResourceResponse<TileJSON | ImageBitmap>>;
export default cogProtocol;
