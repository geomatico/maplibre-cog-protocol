import { CogMetadata, ColorFunction, ImageRenderer } from '../../types';
import { colorTile } from '../colorTile';

const getColorFunctionRenderer =
  (colorFunction: ColorFunction): ImageRenderer<CogMetadata> =>
  (data, metadata) =>
    colorTile(data, metadata, (px, color) => colorFunction(px, color, metadata));

export default getColorFunctionRenderer;
