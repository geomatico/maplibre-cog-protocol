import cogProtocol from './cogProtocol';
import {colorScale, colorSchemeNames} from './render/colorScale';
import setColorFunction from './render/custom/setColorFunction';
import locationValues from './read/locationValues';
import {getCogMetadata, setRequestHeaders} from './read/CogReader';
import proj4 from 'proj4';

export {cogProtocol, colorScale, colorSchemeNames, setColorFunction, locationValues, getCogMetadata, setRequestHeaders, proj4};
