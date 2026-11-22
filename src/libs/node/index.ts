/*
 * Node-only (uses node:fs). Never re-export this from '@libs': it is imported only by the
 * 'dotvar/node' and 'dotvar/config' entry points.
 */
export { load, read } from './loader';
