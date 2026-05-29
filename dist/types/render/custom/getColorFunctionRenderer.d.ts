import type { CogMetadata, ColorFunction, ImageRenderer } from '../../types';
declare const getColorFunctionRenderer: (colorFunction: ColorFunction) => ImageRenderer<CogMetadata>;
export default getColorFunctionRenderer;
