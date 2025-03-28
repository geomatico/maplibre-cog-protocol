import { TILE_SIZE } from '../../src/constants';
import { colorTile } from '../../src/render/colorTile';
import { ColorFunction, MaskRows, RendererMetadata } from '../../src/types';

describe('colorTile', () => {
  describe('no mask', () => {
    test('it should call the provided colorPixel function', () => {
      const colorPixel = jest.fn(() => {});

      colorTile([new Uint8Array(3)], {} as RendererMetadata, colorPixel);

      expect(colorPixel).toHaveBeenCalled();
    });
  });

  describe('mask', () => {
    test(`it should throw an error if it tries to render a tile we don't have zoom level metadata for`, () => {
      const metadata = {
        x: 1,
        y: 2,
        z: 0,
        zoomLevelMetadata: new Map(),
        maskData: [] as MaskRows,
        tileSize: TILE_SIZE,
      } as RendererMetadata;

      expect(() => colorTile([new Uint8Array(3)], metadata, jest.fn())).toThrow('No zoom metadata found for zoom level 0');
    });

    test('it should only render pixels within the mask', () => {
      const tileSize = 3;
      const pixelCount = tileSize * tileSize;
      const tile: Uint8Array[] = [new Uint8Array(pixelCount).fill(0).map((_value, index) => index + 1)];

      const metadata = {
        x: 1,
        y: 2,
        z: 0,
        zoomLevelMetadata: new Map([
          [
            0,
            {
              bbox: [201640.88061629495, 5098655.534734398, 206532.85042654624, 5102018.763978946],
              rasterHeight: 500,
              rasterWidth: 500,
              x: 0,
              y: 0,
              z: 18,
            },
          ],
        ]),
        maskData: [
          [], // mask row 0 - tiles row 0 - tile pixel row 0
          [], // mask row 1 - tiles row 0 - tile pixel row 1
          [], // mask row 2 - tiles row 0 - tile pixel row 2
          [], // mask row 3 - tiles row 1 - tile pixel row 0
          [], // mask row 4 - tiles row 1 - tile pixel row 1
          [], // mask row 5 - tiles row 1 - tile pixel row 2
          [], // mask row 6 - tiles row 2 - tile pixel row 0
          [[5, 6]], // mask row 7 - tiles row 2 - tile pixel row 1
          [], // mask row 8 - tiles row 2 - tile pixel row 2
          [], // mask row 9 - tiles row 3 - tile pixel row 0
          [], // mask row 10 - tiles row 3 - tile pixel row 1
          [], // mask row 11 - tiles row 3 - tile pixel row 2
        ],
        tileSize,
      } as RendererMetadata;

      const expected = new Uint8ClampedArray(pixelCount * 4);

      for (let index = 20; index < 24; index++) {
        expected[index] = 255;
      }

      const colorPixel: ColorFunction = (_px, color) => color.set([255, 255, 255, 255]);

      const result = colorTile(tile, metadata, colorPixel);

      expect(isEqualArray(result, expected)).toBe(true);
    });
  });
});

const isEqualArray = (a: Uint8ClampedArray, b: Uint8ClampedArray): boolean => {
  if (a.length != b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] != b[i]) return false;
  }
  return true;
};
