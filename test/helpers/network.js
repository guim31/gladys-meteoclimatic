// -----------------------------------------------------------------------------
// A simulated Meteoclimatic: the RSS feeds of test/fixtures/feeds, recorded
// from the live service on 2026-10-24 (ISO-8859-15 bytes, as served). Tests
// never touch the real network.
//
// The fixtures carry the times of the day they were taken: `fresh()` moves
// them to "now", so the same answer reads as a recent reading, and
// `withValues()` changes the data block of a station (rain, wind...).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

/** A feed fixture, decoded (test/fixtures/feeds/<name>.xml). */
export const feed = (name) =>
  new TextDecoder('iso-8859-15').decode(
    readFileSync(new URL(`../fixtures/feeds/${name}.xml`, import.meta.url)),
  );

/** Station codes of the fixtures. */
export const BARCELONA = 'ESCAT0800000008350A';
export const MADRID = 'ESMAD2800000028923A';
export const VALENCIA = 'ESPVA4600000046729B';
export const NO_RAIN_GAUGE = 'ESMAD2800000028529A';

export const STATION_FIXTURES = {
  [BARCELONA]: 'station-barcelona',
  [MADRID]: 'station-madrid',
  [VALENCIA]: 'station-valencia',
  [NO_RAIN_GAUGE]: 'station-no-rain-gauge',
};

/** Every <pubDate> of the items moved so that the newest is `ageMs` before `now`. */
export function fresh(xml, now, ageMs = 5 * 60_000) {
  const items = [...xml.matchAll(/<item>[\s\S]*?<pubDate>([^<]+)<\/pubDate>/g)];
  if (items.length === 0) {
    return xml;
  }
  const newest = Math.max(...items.map((match) => Date.parse(match[1])));
  return xml.replace(/(<item>[\s\S]*?<pubDate>)([^<]+)(<\/pubDate>)/g, (all, open, date, close) => {
    const shifted = now - ageMs - (newest - Date.parse(date));
    return `${open}${new Date(shifted).toUTCString().replace('GMT', '+0000')}${close}`;
  });
}

/**
 * The data block of the station feed with some values replaced:
 * { rain: 3.2, windMax: 45 } (Meteoclimatic writes decimal commas).
 */
export function withValues(xml, { rain, windMax, temperature } = {}) {
  const comma = (value) => String(value).replace('.', ',');
  return xml.replace(
    /\[\[<([A-Z0-9]+);\(([^;]*);([^)]*)\);(\([^)]*\));(\([^)]*\));\(([^;]*);([^;]*);([^)]*)\);\(([^)]*)\);/,
    (all, code, t, tRest, h, p, w, wMax, dir, r) =>
      `[[<${code};(${temperature === undefined ? t : comma(temperature)};${tRest});${h};${p};` +
      `(${w};${windMax === undefined ? wMax : comma(windMax)};${dir});(${rain === undefined ? r : comma(rain)});`,
  );
}

/**
 * @param {object} [options]
 * @param {Record<string, unknown>} [options.feeds] code → xml, a function
 *   (now) => xml, an Error to throw, or { status } for an HTTP error. Codes
 *   not listed answer the empty feed, like Meteoclimatic.
 * @param {() => number} [options.now]
 */
export function createNetwork({ feeds = {}, now = () => Date.now() } = {}) {
  const calls = [];

  async function fetch(url, options = {}) {
    const href = String(url);
    calls.push({ url: href, headers: options.headers ?? {} });
    const match = /^https:\/\/www\.meteoclimatic\.net\/feed\/rss\/([A-Za-z0-9]+)$/.exec(href);
    if (!match) {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    }
    // Like the real server (checked 2026-10-24): an Accept naming XML types is a 406.
    const accept = options.headers?.accept;
    if (accept !== undefined && accept !== '*/*') {
      return new Response('Not Acceptable', { status: 406 });
    }
    const route = feeds[match[1]] ?? feed('empty');
    const value = typeof route === 'function' ? route(now()) : route;
    if (value instanceof Error) {
      throw value;
    }
    if (value && typeof value === 'object' && value.status) {
      return new Response('Service Unavailable', { status: value.status });
    }
    // Served as Meteoclimatic serves it: ISO-8859-15 bytes.
    const bytes = Uint8Array.from(value, (char) => {
      const code = char.charCodeAt(0);
      return code === 0x20ac ? 0xa4 : code < 256 ? code : 0x3f;
    });
    return new Response(bytes, {
      status: 200,
      headers: { 'content-type': 'application/xml+rss; charset=iso-8859-15' },
    });
  }

  return {
    fetch,
    calls,
    feeds,
    /** Calls for one code. */
    callsFor: (code) => calls.filter((call) => call.url.endsWith(`/rss/${code}`)).length,
  };
}

/** Station feeds served fresh, by code. */
export function freshStations(codes) {
  return Object.fromEntries(
    codes.map((code) => [code, (now) => fresh(feed(STATION_FIXTURES[code]), now)]),
  );
}
