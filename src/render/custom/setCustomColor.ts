import CustomRendererStore from './rendererStore';
import {PixelToColorFunction} from '../../types';
import getCustomPixelRenderer from './getCustomPixelRenderer';

const setCustomColor = (url: string, toColorFunction: PixelToColorFunction) => {
  CustomRendererStore.set(url, getCustomPixelRenderer(toColorFunction));
}

export default setCustomColor;
