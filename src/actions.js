// -----------------------------------------------------------------------------
// The buttons of the Configuration screen (manifest `actions`).
//
//   find_nearby    : the stations online around a house of Gladys (its
//                    location, `location: true` in the manifest), with their
//                    distance — to pick the codes to read.
//   check_stations : what each configured station answers right now.
// -----------------------------------------------------------------------------

import { fetchNearby } from './api.js';
import { MESSAGES, TEXT } from './i18n.js';

export const ACTION = {
  FIND_NEARBY: 'find_nearby',
  CHECK_STATIONS: 'check_stations',
};

/** Radii offered by the search (km), and the one used when none is picked. */
export const RADII_KM = ['5', '10', '25', '50'];
const DEFAULT_RADIUS_KM = 10;

/** The search lists this many stations at most (the message stays readable). */
const MAX_LISTED = 10;

/**
 * @param {object} gladys
 * @param {{ house?: string, radius_km?: string }} fields
 * @param {{ fetch?: typeof fetch }} [deps]
 */
export async function findNearby(gladys, fields, deps) {
  const houses = (await gladys.getHouses()).filter(
    (house) => typeof house.latitude === 'number' && typeof house.longitude === 'number',
  );
  const house = fields.house
    ? houses.find((candidate) => candidate.selector === fields.house)
    : houses[0];
  if (!house) {
    throw new Error(MESSAGES.thrown(TEXT.noHouse));
  }
  const radiusKm = RADII_KM.includes(String(fields.radius_km))
    ? Number(fields.radius_km)
    : DEFAULT_RADIUS_KM;
  const found = await fetchNearby(house, radiusKm, deps);
  const stations = found.slice(0, MAX_LISTED).map((station) => ({
    code: station.code,
    name: station.name,
    province: station.province,
    distanceKm: Math.round(station.distanceKm * 10) / 10,
  }));
  return MESSAGES.nearby({ house: house.name, radiusKm, stations });
}

/**
 * Read every configured station (unless read in the last minute) and report.
 * @param {import('./hub.js').Hub} hub
 * @param {ReturnType<import('./poller.js').createPoller>} poller
 * @param {object} config the normalized config
 */
export async function checkStations(hub, poller, config) {
  if (config.stations.length === 0) {
    return TEXT.nothingConfigured;
  }
  await poller.refreshNow(config.stations, { maxAgeMs: 60_000 });
  const lines = config.stations.map((code) => {
    const record = hub.records.get(code);
    const result = hub.lastResults.get(code);
    const error = result && !result.ok ? result.error : null;
    return MESSAGES.checkStation({
      code,
      name: record?.name ?? '',
      minutes: error ? null : hub.ageMinutes(record),
      stale: hub.isStale(record),
      error,
      zone: !record && Boolean(result?.zone),
    });
  });
  if (config.invalidCodes.length > 0) {
    lines.push(MESSAGES.invalidCodes(config.invalidCodes));
  }
  if (config.droppedCodes.length > 0) {
    lines.push(MESSAGES.tooMany(config.stations.length));
  }
  return Object.fromEntries(
    Object.keys(lines[0]).map((lang) => [lang, lines.map((line) => line[lang]).join('\n')]),
  );
}
