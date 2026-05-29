import getColorFunctionRenderer from './getColorFunctionRenderer';
import CustomRendererStore from './rendererStore';
const setColorFunction = (url, colorFunction) => {
    if (colorFunction === undefined) {
        CustomRendererStore.delete(url);
    }
    else {
        CustomRendererStore.set(url, getColorFunctionRenderer(colorFunction));
    }
};
export default setColorFunction;
