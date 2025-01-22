import { TypedArray } from 'geotiff';

export type TileJSON = {
  readonly tilejson: '2.2.0';
  readonly tiles: Array<string>;
  readonly name?: string;
  readonly description?: string;
  readonly version?: string;
  readonly attribution?: string;
  readonly template?: string;
  readonly legend?: string;
  readonly scheme?: string;
  readonly grids?: Array<string>;
  readonly data?: Array<string>;
  readonly minzoom: number;
  readonly maxzoom: number;
  readonly bounds?: Array<number>;
  readonly center?: Array<number>;
};

export type TileIndex = {
  readonly z: number;
  readonly x: number;
  readonly y: number;
};

export type Bbox = [number, number, number, number];

export interface XYBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export type ZoomMetadata = TileIndex & {
  readonly bbox: Bbox;
  readonly rasterWidth: number;
  readonly rasterHeight: number;
};

export type CogMetadata = {
  readonly offset: number;
  readonly scale: number;
  readonly noData?: number;
  readonly photometricInterpretation?: number;
  readonly bitsPerSample?: Array<number>;
  readonly colorMap?: Array<number>;
  readonly artist?: string;
  readonly bbox?: Bbox;
  readonly images: Array<ImageMetadata>;
  readonly minzoom: number;
  readonly maxzoom: number;
  readonly zoomLevelMetadata: Map<number, ZoomMetadata>;
};

export type ImageMetadata = {
  readonly zoom: number;
  readonly isOverview: boolean;
  readonly isMask: boolean;
};

export type ImageRenderer<T extends object> = (data: TypedArray[], options: T, maskData?: MaskRows) => Uint8ClampedArray;

export type Location = {
  readonly latitude: number;
  readonly longitude: number;
};

export type LatLonZoom = {
  readonly latitude: number;
  readonly longitude: number;
  readonly zoom: number;
};

export type TilePixel = {
  readonly tileIndex: TileIndex;
  readonly row: number;
  readonly column: number;
};

export type PixelValue = Array<number>;
export type RGBAValue = Uint8ClampedArray;
export type ColorFunction = (pixel: PixelValue, color: RGBAValue, metadata?: CogMetadata, pixelIndex?: number) => void;

export type MaskRows = number[][][];
export type RendererMetadata = CogMetadata & TileIndex & { tileSize: number; maskData?: MaskRows };
