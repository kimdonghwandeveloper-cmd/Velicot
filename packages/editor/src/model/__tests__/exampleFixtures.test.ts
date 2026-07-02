import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { deserializeModel } from '../serializer';

// Validates the Phase 5 four-state example fixtures under docs/examples/
// against the real *.kfm.json parser (plan.md §5.1 schema).
const here = dirname(fileURLToPath(import.meta.url));
const examplesDir = resolve(here, '../../../../../docs/examples');

describe('four-state example fixtures', () => {
  it.each(['idle', 'working', 'done', 'error'] as const)(
    '%s.kfm.json deserializes into a valid CanvasModel with an animatable track',
    (state) => {
      const json = readFileSync(resolve(examplesDir, `${state}.kfm.json`), 'utf-8');
      const model = deserializeModel(json);

      expect(model.layers.length).toBeGreaterThan(0);
      expect(model.animation).toBeDefined();
      expect(model.animation!.tracks.length).toBeGreaterThan(0);
      // Every track must target a layer that actually exists.
      const layerIds = new Set(model.layers.map((l) => l.id));
      for (const track of model.animation!.tracks) {
        expect(layerIds.has(track.targetLayerId)).toBe(true);
      }
    },
  );
});
