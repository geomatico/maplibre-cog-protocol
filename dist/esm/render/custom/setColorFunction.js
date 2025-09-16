import CustomRendererStore from './rendererStore';
import getColorFunctionRenderer from './getColorFunctionRenderer';
const setColorFunction = (url, colorFunction) => {
    CustomRendererStore.set(url, getColorFunctionRenderer(colorFunction));
};
export default setColorFunction;
