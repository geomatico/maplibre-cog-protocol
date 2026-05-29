import type { CogMetadata, ImageRenderer } from '../types';
import { type ColorScaleParams } from './colorScale';
type Options = CogMetadata & {
    colorScale: ColorScaleParams;
};
declare const renderColor: ImageRenderer<Options>;
export default renderColor;
