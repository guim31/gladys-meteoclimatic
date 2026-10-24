// -----------------------------------------------------------------------------
// The integration on the SDK's fake Gladys, against the simulated
// Meteoclimatic: discovery, states, the container's own timer, freshness,
// persistence, status.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAll, createWorld, discovered } from './helpers/world.js';
import {
  BARCELONA,
  MADRID,
  NO_RAIN_GAUGE,
  VALENCIA,
  feed,
  fresh,
  withValues,
} from './helpers/network.js';
import { MemoryStore } from '../src/store.js';
import { TEXT } from '../src/i18n.js';

const state = (w, code, key) =>
  w.gladys.fake.lastState(w.gladys.externalIds('station', code).feature(key));

test('discovery: one device per station read, features learnt from its data', async () => {
  const w = await createWorld({
    stations: [BARCELONA, NO_RAIN_GAUGE],
    feeds: { ESCAT08: feed('zone-ESCAT08') },
    config: {
      stations: `${BARCELONA}, https://www.meteoclimatic.net/perfil/${NO_RAIN_GAUGE}, ESCAT08, ESXXX00000000000Z`,
    },
  });
  const devices = w.gladys.fake.discoveredDevices;
  assert.deepEqual(
    devices.map((d) => d.name),
    ['Meteoclimatic Arenys de Mar', 'Meteoclimatic Rivas - Pueblo'],
  );
  const barcelona = discovered(w, BARCELONA);
  assert.equal(barcelona.external_id, 'ext:test-integration:station:ESCAT0800000008350A');
  assert.deepEqual(
    barcelona.features.map((f) => f.external_id.split(':').pop()),
    [
      'temperature',
      'temperature_max',
      'temperature_min',
      'humidity',
      'pressure',
      'wind_speed',
      'wind_max',
      'wind_direction',
      'rain_today',
      'age',
    ],
  );
  assert.deepEqual(barcelona.features.map((f) => f.name).slice(0, 3), [
    'Température',
    'Température max. du jour',
    'Température min. du jour',
  ]);
  // No rain gauge, no rain feature.
  assert.ok(
    !discovered(w, NO_RAIN_GAUGE).features.some((f) => f.external_id.endsWith(':rain_today')),
  );
  // Nothing published before the user adds a device.
  assert.equal(w.gladys.fake.states.length, 0);
});

test('a device added: every state now, and the widget refreshed', async () => {
  const w = await createWorld({ stations: [BARCELONA], config: { stations: BARCELONA } });
  await createAll(w);
  assert.equal(state(w, BARCELONA, 'temperature'), 14.8);
  assert.equal(state(w, BARCELONA, 'rain_today'), 2);
  assert.equal(state(w, BARCELONA, 'wind_direction'), 236);
  assert.equal(state(w, BARCELONA, 'age'), 5);
  assert.ok(w.gladys.fake.widgetRefreshes.length > 0);
});

test('the container reads the added stations itself, at the configured pace, without onPoll', async () => {
  const w = await createWorld({
    stations: [BARCELONA, MADRID],
    config: { stations: `${BARCELONA},${MADRID}`, refresh_minutes: '15' },
  });
  // Only Barcelona is added: Madrid, already known, is not read again.
  await w.gladys.fake.deviceCreated(discovered(w, BARCELONA));
  const before = { b: w.network.callsFor(BARCELONA), m: w.network.callsFor(MADRID) };
  await w.run(60);
  const reads = w.network.callsFor(BARCELONA) - before.b;
  assert.ok(reads >= 4 && reads <= 5, `${reads} reads of Barcelona in an hour`);
  assert.equal(w.network.callsFor(MADRID), before.m);
  // The core's onPoll right after a read adds no request.
  await w.gladys.fake.poll(discovered(w, BARCELONA));
  assert.equal(w.network.callsFor(BARCELONA) - before.b, reads);
});

test('a station gone silent: its values are no longer published, its age keeps going; all again on return', async () => {
  const w = await createWorld({ stations: [VALENCIA], config: { stations: VALENCIA } });
  await createAll(w);
  const published = () => w.gladys.fake.states.length;
  w.network.feeds[VALENCIA] = feed('empty');
  await w.run(120);
  assert.ok(state(w, VALENCIA, 'age') >= 110, String(state(w, VALENCIA, 'age')));
  const temperatures = w.gladys.fake.states.filter((s) =>
    s.device_feature_external_id.endsWith(':temperature'),
  );
  assert.equal(temperatures.length, 1, 'the stale temperature is not published again');
  const count = published();
  w.network.feeds[VALENCIA] = (now) => fresh(feed('station-valencia'), now, 60_000);
  await w.run(15);
  const after = w.gladys.fake.states
    .slice(count)
    .map((s) => s.device_feature_external_id.split(':').pop());
  assert.ok(after.includes('temperature') && after.includes('humidity'), after.join());
  assert.equal(state(w, VALENCIA, 'age'), 1);
});

test('restart: the stations known from /data are published even when offline', async () => {
  const store = new MemoryStore();
  const first = await createWorld({
    stations: [BARCELONA],
    config: { stations: BARCELONA },
    store,
  });
  await first.app.stop();
  const second = await createWorld({ config: { stations: BARCELONA }, store });
  assert.equal(discovered(second, BARCELONA).features.length, 10);
  // Removing the station from the config forgets it.
  await second.gladys.fake.configUpdated({ stations: '' });
  assert.equal(second.gladys.fake.discoveredDevices.length, 0);
  assert.deepEqual(store.data.records, []);
});

test('the status of the Configuration screen', async () => {
  const empty = await createWorld();
  assert.deepEqual(empty.gladys.fake.connectionStatus, {
    connected: false,
    message: TEXT.notConfigured,
  });
  const down = await createWorld({
    config: { stations: BARCELONA },
    feeds: { [BARCELONA]: { status: 503 } },
  });
  assert.deepEqual(down.gladys.fake.connectionStatus, {
    connected: false,
    message: TEXT.apiUnreachable,
  });
  down.network.feeds[BARCELONA] = (now) => fresh(feed('station-barcelona'), now);
  await down.run(15);
  assert.equal(down.gladys.fake.connectionStatus.connected, true);
});

test('a failure to publish the states: logged, and the scene events still go out', async (t) => {
  let rain = 0;
  const w = await createWorld({
    config: { stations: BARCELONA, refresh_minutes: '10' },
    feeds: {
      [BARCELONA]: (now) => fresh(withValues(feed('station-barcelona'), { rain }), now, 60_000),
    },
  });
  await createAll(w);
  t.mock.method(w.gladys, 'publishChangedStates', async () => {
    throw new Error('HTTP 429');
  });
  rain = 1;
  await w.run(10);
  assert.deepEqual(
    w.gladys.fake.sceneEvents.map((e) => e.key),
    ['rain_started'],
  );
  assert.ok(w.hub.issues.isFailing('publish'));
});

test('the widget only shows the features of the device as created in Gladys', async () => {
  const w = await createWorld({ stations: [BARCELONA], config: { stations: BARCELONA } });
  const device = discovered(w, BARCELONA);
  await w.gladys.fake.deviceCreated({
    ...device,
    features: device.features.filter((f) => !f.external_id.endsWith(':rain_today')),
  });
  const { data } = await w.gladys.fake.widgetGet('station', { settings: {}, language: 'en' });
  const tiles = data.content.components.filter((c) => c.type === 'value');
  assert.deepEqual(
    tiles.map((c) => c.device_feature.split(':').pop()),
    ['temperature', 'humidity', 'wind_speed'],
  );
});
