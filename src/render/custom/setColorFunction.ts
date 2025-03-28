import { ColorFunction } from '../../types';
import getColorFunctionRenderer from './getColorFunctionRenderer';
import CustomRendererStore from './rendererStore';

const setColorFunction = (url: string, colorFunction: ColorFunction) => {
  CustomRendererStore.set(url, getColorFunctionRenderer(colorFunction));
};

export default setColorFunction;
