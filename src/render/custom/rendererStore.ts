import { ImageRenderer, RendererMetadata } from '../../types';

type Renderer = ImageRenderer<RendererMetadata>;

const store: Record<string, Renderer> = {};

export default {
  get: (url: string): Renderer | undefined => {
    return store[url];
  },
  set: (url: string, renderer: Renderer) => {
    store[url] = renderer;
  },
};
