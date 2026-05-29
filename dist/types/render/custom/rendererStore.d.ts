import type { CogMetadata, ImageRenderer } from '../../types';
type Renderer = ImageRenderer<CogMetadata>;
declare const _default: {
    get: (url: string) => Renderer | undefined;
    set: (url: string, renderer: Renderer) => void;
    delete: (url: string) => void;
};
export default _default;
