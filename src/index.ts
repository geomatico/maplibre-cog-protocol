import cogProtocol from './cogProtocol';
import {getCogMetadata, setRequestHeaders} from './read/CogReader';
import locationValues from './read/locationValues';
import {colorScale, colorSchemeNames} from './render/colorScale';
import setColorFunction from './render/custom/setColorFunction';
import {clearMask, setMask} from './render/mask';

export {
  clearMask,
  cogProtocol,
  colorScale,
  colorSchemeNames,
  getCogMetadata,
  locationValues,
  setColorFunction,
  setMask,
  setRequestHeaders,
};
