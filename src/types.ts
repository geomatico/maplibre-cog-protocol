import { TypedArray } from 'geotiff';

export type TileJSON = {
  tilejson: '2.2.0';
  tiles: Array<string>;
  name?: string;
  description?: string;
  version?: string;
  attribution?: string;
  template?: string;
  legend?: string;
  scheme?: string;
  grids?: Array<string>;
  data?: Array<string>;
  minzoom: number;
  maxzoom: number;
  bounds?: Array<number>;
  center?: Array<number>;
};

export type TileIndex = {
  z: number;
  x: number;
  y: number;
};

export type Bbox = [number, number, number, number];

export type CogMetadata = {
  offset: number;
  scale: number;
  noData?: number;
  photometricInterpretation?: number;
  bitsPerSample?: Array<number>;
  colorMap?: Array<number>;
  artist?: string;
  bbox?: Bbox;
  images: Array<ImageMetadata>;
  minzoom: number;
  maxzoom: number;
};

export type ImageMetadata = {
  zoom: number;
  isOverview: boolean;
  isMask: boolean;
};

export type ImageRenderer<T extends object> = (data: TypedArray[], options: T) => Uint8ClampedArray;

export type Location = {
  latitude: number;
  longitude: number;
};

export type LatLonZoom = {
  latitude: number;
  longitude: number;
  zoom: number;
};

export type TilePixel = {
  tileIndex: TileIndex;
  row: number;
  column: number;
};

type PixelValue = Array<number>;
type RGBAValue = Uint8ClampedArray;
export type ColorFunction = (pixel: PixelValue, color: RGBAValue, metadata: CogMetadata) => void;
