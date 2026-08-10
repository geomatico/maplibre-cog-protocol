import type {ColorFunction} from '../../types';
import getColorFunctionRenderer from './getColorFunctionRenderer';
import CustomRendererStore from './rendererStore';

const setColorFunction = (url: string, colorFunction: ColorFunction | undefined) => {
  if (colorFunction === undefined) {
    CustomRendererStore.delete(url);
  } else {
    CustomRendererStore.set(url, getColorFunctionRenderer(colorFunction));
  }
};

export default setColorFunction;
