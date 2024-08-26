import { CogMetadata, ImageRenderer } from '../types';
import { ColorScaleParams } from '../render/colorScale';
type Options = CogMetadata & {
    colorScale: ColorScaleParams;
};
declare const renderColor: ImageRenderer<Options>;
export default renderColor;
