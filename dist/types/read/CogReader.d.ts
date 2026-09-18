import type { CogMetadata, TileCoverage, TileIndex, TileJSON, TypedArray } from '../types';
declare const CogReader: (url: string) => {
    getTilejson: (fullUrl: string) => Promise<TileJSON>;
    getMetadata: () => Promise<CogMetadata>;
    getRawTile: {
        (tileIndex: TileIndex, options?: {
            mask?: false;
            tileSize?: number;
        }): Promise<TypedArray>;
        (tileIndex: TileIndex, options: {
            mask: true;
            tileSize?: number;
        }): Promise<TypedArray | null>;
    };
    getTileCoverage: ({ z, x, y }: TileIndex, { tileSize }?: {
        tileSize?: number;
    }) => Promise<TileCoverage>;
};
export declare const getCogMetadata: (url: string) => Promise<CogMetadata>;
export declare const setRequestHeaders: (headers: Record<string, string>) => void;
export default CogReader;
