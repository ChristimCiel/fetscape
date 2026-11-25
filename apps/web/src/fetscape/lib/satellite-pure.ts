/**
 * Pure-JS satellite.js entry for browser workers.
 * Relative imports avoid the package barrel (WASM) that breaks the Vite client graph.
 */

export { json2satrec } from '../../../../../node_modules/satellite.js/dist/io.js';
export { propagate } from '../../../../../node_modules/satellite.js/dist/propagation.js';
