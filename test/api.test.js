// -----------------------------------------------------------------------------
// The feed parser, on real answers of Meteoclimatic (test/fixtures/feeds).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiError,
  decodeEntities,
  distanceKm,
  fetchFeed,
  fetchNearby,
  fetchStation,
  parseFeed,
} from '../src/api.js';
import { BARCELONA, NO_RAIN_GAUGE, VALENCIA, createNetwork, feed } from './helpers/network.js';

test('a station feed: every value, the time, the position, the province', () => {
  const [station] = parseFeed(feed('station-barcelona'));
  assert.deepEqual(station, {
    code: BARCELONA,
    name: 'Arenys de Mar',
    province: 'Barcelona',
    latitude: 41.59,
    longitude: 2.56,
    measuredAt: Date.parse('2026-10-24T19:09:00Z'),
    values: {
      temperature: 14.8,
      temperature_max: 20.1,
      temperature_min: 12.9,
      humidity: 82,
      pressure: 1020.1,
      wind_speed: 0,
      wind_max: 21,
      wind_direction: 236,
      rain_today: 2,
    },
  });
});

test('-99 is a sensor the station does not have: left out', () => {
  const [station] = parseFeed(feed('station-no-rain-gauge'));
  assert.equal(station.code, NO_RAIN_GAUGE);
  assert.equal(station.values.rain_today, undefined);
  assert.equal(station.values.temperature, 13.6);
  const network = parseFeed(feed('network-ES'));
  // Hontoria del Pinar: no hygrometer. Arahal: no anemometer, so no direction either.
  const hontoria = network.find((s) => s.code === 'ESCYL0900000009660A');
  assert.equal(hontoria.values.humidity, undefined);
  assert.equal(hontoria.values.pressure, 1031.8);
  const arahal = network.find((s) => s.code === 'ESAND4100000041600A');
  assert.equal(arahal.values.wind_speed, undefined);
  assert.equal(arahal.values.wind_direction, undefined);
  assert.equal(arahal.name, 'Arahal');
});

test('the names keep their accents (ISO-8859-15 entities and bytes)', () => {
  const names = parseFeed(feed('network-ES')).map((s) => s.name);
  assert.ok(names.includes('Badalona - Bufalà'), names.join(', '));
  assert.ok(names.includes('Alcorcón'));
  assert.equal(decodeEntities('Matar&#243; &amp; co'), 'Mataró & co');
  for (const zone of ['network-PT', 'network-AD']) {
    for (const station of parseFeed(feed(zone))) {
      assert.match(station.code, /^(PT|AD)[A-Z0-9]+$/);
      assert.ok(station.measuredAt > 0 && station.latitude !== null, station.code);
    }
  }
});

test('fetchStation: the station, an empty feed, a zone code', async () => {
  const { fetch, calls } = createNetwork({
    feeds: { [VALENCIA]: feed('station-valencia'), ESCAT08: feed('zone-ESCAT08') },
  });
  const found = await fetchStation(VALENCIA, { fetch });
  assert.equal(found.station.name, 'Ador');
  assert.equal(found.station.province, 'Valencia');
  assert.deepEqual(await fetchStation('ESXXX0000000000000Z', { fetch }), {
    station: null,
    zone: false,
  });
  assert.deepEqual(await fetchStation('ESCAT08', { fetch }), { station: null, zone: true });
  assert.match(calls[0].headers['user-agent'], /gladys-meteoclimatic/);
});

test('fetchFeed: HTTP and network errors are ApiErrors, without the URL', async () => {
  const { fetch } = createNetwork({
    feeds: {
      DOWN: { status: 503 },
      GONE: Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }),
      HTML: '<html>maintenance</html>',
    },
  });
  await assert.rejects(
    fetchFeed('DOWN', { fetch }),
    (err) => err instanceof ApiError && /HTTP 503/.test(err.message),
  );
  await assert.rejects(fetchFeed('GONE', { fetch }), /unreachable \(ECONNRESET\)/);
  await assert.rejects(fetchFeed('HTML', { fetch }), /something else than a feed/);
});

test('fetchNearby: the three zones of the network, nearest first, within the radius', async () => {
  const { fetch, calls } = createNetwork({
    feeds: { ES: feed('network-ES'), PT: feed('network-PT'), AD: feed('network-AD') },
  });
  // Barcelona city centre.
  const found = await fetchNearby({ latitude: 41.39, longitude: 2.17 }, 50, { fetch });
  assert.deepEqual(
    calls.map((c) => c.url.split('/').pop()),
    ['ES', 'PT', 'AD'],
  );
  assert.ok(found.length >= 3);
  assert.ok(found.every((s) => s.distanceKm <= 50));
  assert.deepEqual(
    found,
    [...found].sort((a, b) => a.distanceKm - b.distanceKm),
  );
  assert.ok(found.some((s) => s.code === BARCELONA));
  assert.ok(
    Math.abs(
      distanceKm(
        { latitude: 40.4168, longitude: -3.7038 },
        { latitude: 41.3874, longitude: 2.1686 },
      ) - 505,
    ) < 5,
  );
});
