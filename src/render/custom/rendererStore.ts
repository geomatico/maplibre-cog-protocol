import {CogMetadata, ImageRenderer} from '../../types';

type Renderer = ImageRenderer<CogMetadata>;

const store: Record<string, Renderer> = {};

export default {
  get: (url: string): Renderer | undefined => {
    return store[url];
  },
  set: (url: string, renderer: Renderer) => {
    store[url] = renderer;
  }
};
