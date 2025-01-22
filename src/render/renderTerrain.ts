import { ImageRenderer, RendererMetadata } from '../types';
import { colorTile } from './colorTile';

type Options = RendererMetadata;

const renderTerrain: ImageRenderer<Options> = (data, metadata) => {
  const { noData } = metadata;

  const base = -10000;
  const interval = 0.1;

  return colorTile(data, metadata, ([px], color) => {
    const h = px == noData ? 0 : px;
    const v = (h - base) / interval;

    const red = Math.floor(v / 256 / 256) % 256;
    const green = Math.floor(v / 256) % 256;
    const blue = v % 256;
    const alpha = 255;

    color.set([red, green, blue, alpha]);
  });
};

export default renderTerrain;
