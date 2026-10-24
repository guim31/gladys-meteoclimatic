// -----------------------------------------------------------------------------
// The scene triggers, end to end on the fake Gladys: the rain and wind of
// the day moving in the station feed, silences and returns.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAll, createWorld } from './helpers/world.js';
import { BARCELONA, feed, fresh, withValues } from './helpers/network.js';

/** A world reading Barcelona every 10 minutes, its values set by `set()`. */
async function world(initial = {}) {
  let values = initial;
  const w = await createWorld({
    config: { stations: BARCELONA, refresh_minutes: '10' },
    feeds: {
      [BARCELONA]: (now) => fresh(withValues(feed('station-barcelona'), values), now, 60_000),
    },
  });
  await createAll(w);
  return {
    w,
    set(next) {
      values = { ...values, ...next };
    },
  };
}

// The fake Gladys records each event as { key, data }.
const keyOf = (event) => event.key;
const dataOf = (event) => event.data;

test('the first reading is a baseline: rain and wind already there fire nothing', async () => {
  const { w } = await world({ rain: 5, windMax: 95 });
  await w.run(30);
  assert.deepEqual(w.gladys.fake.sceneEvents, []);
});

test('rain_started once per episode, rain_stopped once per threshold after it', async () => {
  const { w, set } = await world({ rain: 0 });
  set({ rain: 0.4 });
  await w.run(10);
  set({ rain: 1.2 });
  await w.run(10);
  const started = w.gladys.fake.sceneEvents.filter((e) => keyOf(e) === 'rain_started');
  assert.equal(started.length, 1);
  assert.equal(dataOf(started[0]).rain_today_mm, 0.4);
  assert.equal(dataOf(started[0]).device, w.gladys.externalIds('station', BARCELONA).device);
  assert.equal(dataOf(started[0]).station, 'Meteoclimatic Arenys de Mar');
  await w.run(130);
  const stopped = w.gladys.fake.sceneEvents.filter((e) => keyOf(e) === 'rain_stopped');
  assert.deepEqual(
    stopped.map((e) => dataOf(e).after_minutes),
    ['30', '60', '120'],
  );
  assert.equal(dataOf(stopped[0]).rain_today_mm, 1.2);
  // A new shower after the dry spell: a new episode.
  set({ rain: 2 });
  await w.run(10);
  assert.equal(w.gladys.fake.sceneEvents.filter((e) => keyOf(e) === 'rain_started').length, 2);
});

test('gust_above: once per threshold crossed by the wind max of the day, again after midnight', async () => {
  const { w, set } = await world({ windMax: 21 });
  set({ windMax: 45 });
  await w.run(10);
  set({ windMax: 52 });
  await w.run(10);
  const gusts = () => w.gladys.fake.sceneEvents.filter((e) => keyOf(e) === 'gust_above');
  assert.deepEqual(
    gusts().map((e) => dataOf(e).above_kmh),
    ['30', '40', '50'],
  );
  assert.equal(dataOf(gusts()[2]).wind_max_kmh, 52);
  // New day: the maximum restarts low, then climbs again.
  set({ windMax: 5 });
  await w.run(10);
  set({ windMax: 35 });
  await w.run(10);
  assert.deepEqual(
    gusts().map((e) => dataOf(e).above_kmh),
    ['30', '40', '50', '30'],
  );
});

test('station_silent per threshold, then station_back with the length of the silence', async () => {
  const { w } = await world();
  const live = w.network.feeds[BARCELONA];
  w.network.feeds[BARCELONA] = feed('empty');
  await w.run(125);
  const silent = w.gladys.fake.sceneEvents.filter((e) => keyOf(e) === 'station_silent');
  assert.deepEqual(
    silent.map((e) => dataOf(e).after_minutes),
    ['60', '120'],
  );
  w.network.feeds[BARCELONA] = live;
  await w.run(10);
  const back = w.gladys.fake.sceneEvents.filter((e) => keyOf(e) === 'station_back');
  assert.equal(back.length, 1);
  assert.ok(dataOf(back[0]).silent_minutes >= 120, String(dataOf(back[0]).silent_minutes));
});

test('no event for a station not added to Gladys', async () => {
  let rain = 0;
  const w = await createWorld({
    config: { stations: BARCELONA, refresh_minutes: '10' },
    feeds: {
      [BARCELONA]: (now) => fresh(withValues(feed('station-barcelona'), { rain }), now, 60_000),
    },
  });
  rain = 3;
  await w.run(60);
  assert.deepEqual(w.gladys.fake.sceneEvents, []);
});
