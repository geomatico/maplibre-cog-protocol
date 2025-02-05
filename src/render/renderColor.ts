import { ImageRenderer, RendererMetadata } from '../types';
import { colorScale, ColorScaleParams } from './colorScale';
import { colorTile } from './colorTile';

type Options = RendererMetadata & { colorScale: ColorScaleParams };

const renderColor: ImageRenderer<Options> = (data, options) => {
  const { noData, colorScale: colorScaleParams } = options;
  const interpolate = colorScale(colorScaleParams);

  return colorTile(data, options, ([px], color) => {
    if (px === noData || isNaN(px) || px === Infinity) {
      color.set([0, 0, 0, 0]);
    } else {
      color.set([...interpolate(px), 255]);
    }
  });
};

export default renderColor;
