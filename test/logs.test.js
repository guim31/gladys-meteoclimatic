// -----------------------------------------------------------------------------
// Quiet logs: a normal cycle writes nothing at the info level, and a failure
// that lasts writes one line when it starts and one when it ends.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAll, createWorld } from './helpers/world.js';
import { BARCELONA, feed, fresh } from './helpers/network.js';

/** Capture the log lines (the SDK logger writes through console) at a level. */
function capture(t, level) {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = [];
  for (const stream of ['log', 'error']) {
    t.mock.method(console, stream, (...args) => lines.push(args.join(' ')));
  }
  return lines;
}

test('a normal cycle writes nothing at the info level', async (t) => {
  const lines = capture(t, 'info');
  const w = await createWorld({ stations: [BARCELONA], config: { stations: BARCELONA } });
  await createAll(w);
  // Start-up says what it reads and what it found: lifecycle.
  assert.ok(
    lines.some((line) => line.includes('[INFO]') && line.includes(`Station ${BARCELONA} found`)),
  );
  const before = lines.length;
  w.network.feeds[BARCELONA] = (now) => fresh(feed('station-barcelona'), now, 60_000);
  for (let i = 0; i < 12; i += 1) {
    await w.run(15);
    await w.gladys.fake.widgetGet('station', { language: 'fr' });
    await w.gladys.fake.poll(w.gladys.fake.discoveredDevices[0]);
  }
  assert.deepEqual(lines.slice(before), []);
});

test('a lasting failure: one line when it starts, one when it ends', async (t) => {
  const lines = capture(t, 'info');
  const w = await createWorld({ stations: [BARCELONA], config: { stations: BARCELONA } });
  await createAll(w);
  const before = lines.length;
  const live = w.network.feeds[BARCELONA];
  w.network.feeds[BARCELONA] = { status: 503 };
  await w.run(45);
  w.network.feeds[BARCELONA] = live;
  await w.run(15);
  const logged = lines.slice(before);
  assert.equal(logged.filter((line) => line.includes('HTTP 503')).length, 1, logged.join('\n'));
  assert.equal(logged.filter((line) => line.includes('Meteoclimatic answers again')).length, 1);
});

test('a station gone silent: said once when it becomes stale, once when it is back', async (t) => {
  const lines = capture(t, 'info');
  const w = await createWorld({ stations: [BARCELONA], config: { stations: BARCELONA } });
  await createAll(w);
  const before = lines.length;
  const live = w.network.feeds[BARCELONA];
  w.network.feeds[BARCELONA] = feed('empty');
  await w.run(180);
  w.network.feeds[BARCELONA] = live;
  await w.run(15);
  const logged = lines.slice(before);
  assert.equal(logged.length, 2, logged.join('\n'));
  assert.match(logged[0], /\[WARN\].*Arenys de Mar: no reading for \d+ min/);
  assert.match(logged[1], /\[INFO\].*Arenys de Mar: readings again/);
});
