import { it, expect } from 'vitest';
import { validateAssets } from '../scripts/validate-assets';
it('ships every unique supplied model as a bounded, self-contained, hash-verified GLB', () => {
  const result = validateAssets();
  expect(result.assets).toHaveLength(7);
  expect(result.totalBytes).toBeLessThan(15000000);
});
