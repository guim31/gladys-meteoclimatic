import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_STATIONS, normalizeConfig, parseStationCodes } from '../src/config.js';

test('station codes: separators, profile addresses, lowercase, duplicates, garbage', () => {
  assert.deepEqual(
    parseStationCodes(
      'escat0800000008350A; https://www.meteoclimatic.net/perfil/ESMAD2800000028923A\nESCAT0800000008350A, #12, ',
    ),
    { valid: ['ESCAT0800000008350A', 'ESMAD2800000028923A'], invalid: ['#12'] },
  );
});

test('defaults and bounds', () => {
  assert.deepEqual(normalizeConfig(), {
    stations: [],
    invalidCodes: [],
    droppedCodes: [],
    refreshMinutes: 15,
    language: 'fr',
  });
  const many = Array.from(
    { length: 12 },
    (_, i) => `ESCAT08000000083${String(i).padStart(2, '0')}A`,
  );
  const config = normalizeConfig({
    stations: many.join(','),
    refresh_minutes: '5',
    language: 'it',
  });
  assert.equal(config.stations.length, MAX_STATIONS);
  assert.equal(config.droppedCodes.length, 2);
  assert.equal(config.refreshMinutes, 15);
  assert.equal(config.language, 'fr');
});
