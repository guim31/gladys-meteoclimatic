// -----------------------------------------------------------------------------
// The trigger tracker alone, on the edge cases found in review: restarts,
// local midnight, silences after rain, Meteoclimatic down.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTriggerTracker } from '../src/triggers.js';

const MIN = 60_000;
const T0 = Date.parse('2026-10-24T10:00:00Z');
// Days in UTC, whatever the time zone of the machine running the tests.
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const reading = (at, values) => ({ measuredAt: at, values });

test('a restart after a long stop, then a failed first read: no "station back"', () => {
  // Last reading known from /data: three hours before the start.
  const tracker = createTriggerTracker({ lastReadingAt: T0 - 180 * MIN, startedAt: T0, dayOf });
  tracker.onTick(T0 + MIN);
  tracker.onTick(T0 + 20 * MIN);
  const { backAfterMinutes } = tracker.onReading(reading(T0 + 25 * MIN, {}));
  assert.equal(backAfterMinutes, null);
});

test('a silence that starts while running: "station back" with its length', () => {
  const tracker = createTriggerTracker({ startedAt: T0, dayOf });
  tracker.onReading(reading(T0, {}));
  tracker.onTick(T0 + 61 * MIN);
  assert.equal(tracker.onReading(reading(T0 + 70 * MIN, {})).backAfterMinutes, 70);
});

test('Meteoclimatic down: no silence, no return', () => {
  const tracker = createTriggerTracker({ startedAt: T0, dayOf });
  tracker.onReading(reading(T0, {}));
  tracker.onTick(T0 + MIN);
  const down = tracker.onTick(T0 + 130 * MIN, { serviceDown: true });
  assert.deepEqual(down.silent, []);
  assert.equal(tracker.onReading(reading(T0 + 140 * MIN, {})).backAfterMinutes, null);
});

test('rain then silence: no "rain stops" until a reading shows the dry spell', () => {
  const tracker = createTriggerTracker({ startedAt: T0, dayOf });
  tracker.onReading(reading(T0, { rain_today: 0 }));
  assert.equal(tracker.onReading(reading(T0 + 10 * MIN, { rain_today: 1 })).rainStarted, true);
  assert.deepEqual(tracker.onTick(T0 + 200 * MIN).dry, []);
  tracker.onReading(reading(T0 + 75 * MIN, { rain_today: 1 }));
  assert.deepEqual(tracker.onTick(T0 + 210 * MIN).dry, [30, 60]);
});

test('midnight: the new day compares with 0, even above the day before', () => {
  const tracker = createTriggerTracker({ startedAt: T0, dayOf });
  const evening = Date.parse('2026-10-24T23:50:00Z');
  tracker.onReading(reading(evening, { wind_max: 50, rain_today: 4 }));
  const after = tracker.onReading(reading(evening + 20 * MIN, { wind_max: 55, rain_today: 5 }));
  assert.deepEqual(after.gusts, [30, 40, 50]);
  assert.equal(after.rainStarted, true);
});

test('a drop within the day (station restart) fires nothing, the next rise does', () => {
  const tracker = createTriggerTracker({ startedAt: T0, dayOf });
  tracker.onReading(reading(T0, { wind_max: 65 }));
  assert.deepEqual(tracker.onReading(reading(T0 + 10 * MIN, { wind_max: 12 })).gusts, []);
  assert.deepEqual(tracker.onReading(reading(T0 + 20 * MIN, { wind_max: 35 })).gusts, [30]);
});
