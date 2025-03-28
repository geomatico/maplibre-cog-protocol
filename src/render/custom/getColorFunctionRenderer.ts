import { ColorFunction, ImageRenderer, RendererMetadata } from '../../types';
import { colorTile } from '../colorTile';

const getColorFunctionRenderer =
  (colorFunction: ColorFunction): ImageRenderer<RendererMetadata> =>
  (data, metadata) =>
    colorTile(data, metadata, (px, color) => colorFunction(px, color, metadata));

export default getColorFunctionRenderer;
