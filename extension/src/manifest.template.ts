import { createManifest } from './manifest.base';

export const templateScalePageMatches = [
  'https://scale.example.com/scale/*',
  'https://scale.example.com/WarehouseMobile*',
  'https://scale.example.com/warehousemobile*',
  'https://scaleadfs.example.com/adfs/*',
];

const manifest = createManifest(templateScalePageMatches);

export default manifest;