import { CogMetadata, TileIndex, TileJSON, TypedArray } from '@/types';
declare const CogReader: (url: string) => {
    getTilejson: (fullUrl: string) => Promise<TileJSON>;
    getMetadata: () => Promise<CogMetadata>;
    getRawTile: ({ z, x, y }: TileIndex, tileSize?: number) => Promise<TypedArray[]>;
};
export default CogReader;
