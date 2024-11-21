import CustomRendererStore from './rendererStore';
import {ColorFunction} from '../../types';
import getColorFunctionRenderer from './getColorFunctionRenderer';

const setColorFunction = (url: string, colorFunction: ColorFunction) => {
  CustomRendererStore.set(url, getColorFunctionRenderer(colorFunction));
}

export default setColorFunction;
