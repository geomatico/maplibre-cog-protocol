import { GetResourceResponse, RequestParameters } from 'maplibre-gl';
import { TileJSON } from './types';
declare const cogProtocol: (params: RequestParameters) => Promise<GetResourceResponse<TileJSON | ImageBitmap>>;
export default cogProtocol;
