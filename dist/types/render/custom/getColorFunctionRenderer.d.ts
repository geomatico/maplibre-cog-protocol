import { CogMetadata, ImageRenderer, ColorFunction } from '../../types';
declare const getColorFunctionRenderer: (colorFunction: ColorFunction) => ImageRenderer<CogMetadata>;
export default getColorFunctionRenderer;
