// -----------------------------------------------------------------------------
// Integration configuration.
//
// The configuration is filled in by the user in Gladys, from the `config_schema`
// declared in `gladys-assistant-integration.json`. This module provides the
// defaults and normalizes the received object, so the rest of the code never
// deals with `undefined`, strings typed with spaces, or invalid values.
// -----------------------------------------------------------------------------

/** The languages of the Gladys interface, the ones every text carries. */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/** The refresh intervals offered, in minutes (stations upload every 10 minutes or so). */
export const REFRESH_MINUTES = ['10', '15', '30', '60'];

/**
 * At most this many stations are read: Meteoclimatic is a volunteer network,
 * and each station is one request per cycle.
 */
export const MAX_STATIONS = 10;

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  stations: '', // station codes, e.g. "ESCAT0800000008350A, ESMAD2800000028923A"
  refresh_minutes: '15', // how often the stations are read
  language: 'fr', // language of the feature names and of the generated texts
};

/**
 * Merge the user config with the defaults and normalize every value.
 * @param {Record<string, unknown>} [raw] config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const codes = parseStationCodes(raw.stations ?? DEFAULT_CONFIG.stations);
  const refresh = String(raw.refresh_minutes ?? DEFAULT_CONFIG.refresh_minutes).trim();
  const language = String(raw.language ?? DEFAULT_CONFIG.language).trim();
  return {
    stations: codes.valid.slice(0, MAX_STATIONS),
    invalidCodes: codes.invalid,
    droppedCodes: codes.valid.slice(MAX_STATIONS),
    refreshMinutes: REFRESH_MINUTES.includes(refresh)
      ? Number(refresh)
      : Number(DEFAULT_CONFIG.refresh_minutes),
    language: LANGUAGES.includes(language) ? language : DEFAULT_CONFIG.language,
  };
}

/**
 * A station code: two letters of country, then letters and digits
 * (ESCAT0800000008350A, PTSUL..., ADAND9000000600000A).
 */
const CODE = /^[A-Z]{2}[A-Z0-9]{5,30}$/;

/**
 * Split a typed list of station codes. Commas, semicolons and spaces separate
 * them; the profile address copied from the website
 * (https://www.meteoclimatic.net/perfil/ESCAT0800000008350A) is accepted, and
 * lowercase too. Duplicates are dropped, the order is kept.
 * @param {unknown} text
 * @returns {{ valid: string[], invalid: string[] }}
 */
export function parseStationCodes(text) {
  const valid = [];
  const invalid = [];
  for (const token of String(text).split(/[\s,;]+/)) {
    if (token === '') {
      continue;
    }
    const code = token
      .replace(/^https?:\/\/(www\.)?meteoclimatic\.net\/(perfil|feed\/rss)\//i, '')
      .replace(/[/?#].*$/, '')
      .toUpperCase();
    if (CODE.test(code)) {
      if (!valid.includes(code)) {
        valid.push(code);
      }
    } else {
      invalid.push(token);
    }
  }
  return { valid, invalid };
}

/** The refresh period, in milliseconds. */
export function periodMs(config) {
  return config.refreshMinutes * 60_000;
}
