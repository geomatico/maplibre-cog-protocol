import { Location } from '@/types';
declare const locationValues: (url: string, { latitude, longitude }: Location, zoom?: number) => Promise<Array<number>>;
export default locationValues;
