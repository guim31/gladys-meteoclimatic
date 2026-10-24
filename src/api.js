// -----------------------------------------------------------------------------
// The Meteoclimatic RSS feeds (no account, no key).
//
//   https://www.meteoclimatic.net/feed/rss/<code>
//
// <code> is a station (ESCAT0800000008350A) or a zone (ES, ESCAT, ESCAT08, PT,
// AD): the feed lists the stations of the zone that uploaded recently (about
// the last hour). A station offline for a while, an unknown code, or a zone
// without station all give the same empty feed (HTTP 200, no <item>).
//
// The feed is ISO-8859-15. Each <item> carries, besides an HTML summary, a
// machine-readable block in an XML comment, the one this module reads:
//
//   [[<ESCAT0800000008350A;(14,8;20,1;12,9;hazemoon);(82,0;89,0;70,0);
//      (1020,1;1022,9;1019,7);(0,0;21,0;236);(2,0);Arenys de Mar>]]
//
//   (temperature; max of the day; min of the day; sky)  °C
//   (humidity; max; min)                                %
//   (pressure; max; min)                                hPa
//   (wind; max of the day; direction)                   km/h, degrees
//   (rain of the day)                                   mm
//   name, HTML entities included
//
// A sensor the station does not have reads -99 (seen on the live network:
// no anemometer, no barometer, no hygrometer, no rain gauge). The time of the
// reading is the item's <pubDate>; the position its <georss:point> (two
// decimals, about a kilometre).
//
// The data is CC BY-NC-ND 3.0 (the feed says so): the integration shows it
// unchanged, credits Meteoclimatic, and asks politely (one station at a time,
// 10 minutes at least between two reads of a station).
// -----------------------------------------------------------------------------

const BASE_URL = 'https://www.meteoclimatic.net/feed/rss/';
const USER_AGENT = 'gladys-meteoclimatic (+https://github.com/guim31/gladys-meteoclimatic)';
// Per request: the search reads three feeds and the check up to ten
// stations, within the timeouts of their actions (60 s, 120 s).
const TIMEOUT_MS = 10_000;

/** The value of a sensor the station does not have. */
const MISSING = -99;

/** The zones read by the nearby search: every station of the network. */
export const NETWORK_ZONES = ['ES', 'PT', 'AD'];

export class ApiError extends Error {}

/**
 * Fetch a feed and decode it (ISO-8859-15).
 * @param {string} code station or zone
 * @param {{ fetch?: typeof fetch }} [deps]
 * @returns {Promise<string>}
 */
export async function fetchFeed(code, { fetch = globalThis.fetch } = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${encodeURIComponent(code)}`, {
      // Any Accept naming XML types gets a 406: the server answers
      // `application/xml+rss`, which it only serves to */*.
      headers: { 'user-agent': USER_AGENT, accept: '*/*' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err?.name === 'TimeoutError' ? 'timeout' : (err?.cause?.code ?? err.message);
    throw new ApiError(`Meteoclimatic unreachable (${reason})`);
  }
  if (!response.ok) {
    throw new ApiError(`Meteoclimatic answered HTTP ${response.status}`);
  }
  const text = new TextDecoder('iso-8859-15').decode(await response.arrayBuffer());
  if (!/<rss[\s>]/.test(text)) {
    throw new ApiError('Meteoclimatic answered something else than a feed');
  }
  return text;
}

/** Decode the entities of a text from the feed (&#225; &amp; ...). */
export function decodeEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (all, name) => named[name.toLowerCase()] ?? all)
    .trim();
}

/** "14,8" -> 14.8; -99 (no such sensor) and garbage -> null. */
function number(text) {
  const value = Number(String(text).trim().replace(',', '.'));
  if (!Number.isFinite(value) || value <= MISSING) {
    return null;
  }
  return value;
}

const DATA =
  /\[\[<([A-Z]{2}[A-Z0-9]+);\(([^)]*)\);\(([^)]*)\);\(([^)]*)\);\(([^)]*)\);\(([^)]*)\);([^>]*)>\]\]/;

/**
 * One <item> of a feed, or null when it carries no data block.
 * @param {string} item
 */
export function parseItem(item) {
  const data = DATA.exec(item);
  if (!data) {
    return null;
  }
  const [, code, temperature, humidity, pressure, wind, rain, name] = data;
  const [t, tMax, tMin] = temperature.split(';');
  const [h] = humidity.split(';');
  const [p] = pressure.split(';');
  const [w, wMax, direction] = wind.split(';');
  const pubDate = /<pubDate>([^<]+)<\/pubDate>/.exec(item)?.[1];
  const measuredAt = pubDate ? Date.parse(pubDate) : NaN;
  const point = /<georss:point>\s*(-?[\d.]+)\s+(-?[\d.]+)\s*<\/georss:point>/.exec(item);
  const title = /<title>([^<]*)<\/title>/.exec(item)?.[1];
  // The title is "Name (Province)": the province helps tell two namesakes apart.
  const province = title ? /\(([^()]+)\)\s*$/.exec(decodeEntities(title))?.[1] : undefined;
  const values = {
    temperature: number(t),
    temperature_max: number(tMax),
    temperature_min: number(tMin),
    humidity: number(h),
    pressure: number(p),
    wind_speed: number(w),
    wind_max: number(wMax),
    // The direction is only meaningful with an anemometer.
    wind_direction: number(w) === null ? null : number(direction),
    rain_today: number(rain.split(';')[0]),
  };
  return {
    code,
    name: decodeEntities(name) || code,
    province: province ?? null,
    latitude: point ? Number(point[1]) : null,
    longitude: point ? Number(point[2]) : null,
    measuredAt: Number.isFinite(measuredAt) ? measuredAt : null,
    values: Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null)),
  };
}

/**
 * Every station of a feed.
 * @param {string} xml
 */
export function parseFeed(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map((match) => parseItem(match[1]))
    .filter(Boolean);
}

/**
 * The last reading of one station.
 * @param {string} code
 * @param {{ fetch?: typeof fetch }} [deps]
 * @returns {Promise<{ station: object | null, zone: boolean }>} station null
 *   when the feed has no such station (offline, unknown); zone true when the
 *   code is a zone (its feed lists other stations)
 */
export async function fetchStation(code, deps) {
  const stations = parseFeed(await fetchFeed(code, deps));
  const station = stations.find((candidate) => candidate.code === code) ?? null;
  return { station, zone: !station && stations.length > 0 };
}

/** Great-circle distance in km. */
export function distanceKm(a, b) {
  const rad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The stations online within `radiusKm` of a point, the closest first. Reads
 * the whole network (three feeds, about 2 MB), on demand only.
 * @param {{ latitude: number, longitude: number }} center
 * @param {number} radiusKm
 * @param {{ fetch?: typeof fetch }} [deps]
 */
export async function fetchNearby(center, radiusKm, deps) {
  const found = [];
  for (const zone of NETWORK_ZONES) {
    for (const station of parseFeed(await fetchFeed(zone, deps))) {
      if (station.latitude === null || station.longitude === null) {
        continue;
      }
      const distance = distanceKm(center, station);
      if (distance <= radiusKm) {
        found.push({ ...station, distanceKm: distance });
      }
    }
  }
  return found.sort((a, b) => a.distanceKm - b.distanceKm);
}
