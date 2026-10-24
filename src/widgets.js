// -----------------------------------------------------------------------------
// The "Meteoclimatic station" dashboard widget (Gladys 5.1+).
//
// The station chosen in its settings (the first added one otherwise): live
// tiles bound to the device features (temperature, humidity, wind, rain of
// the day), so they follow every state; a status block with the high and low
// of the day, the strongest wind and the reading age; the credit the CC
// BY-NC-ND licence asks for. 4 values + 1 status + 1 text: within the core's
// budget (8 components, 2 texts).
//
// The content is built from what the integration already read: showing the
// widget never calls Meteoclimatic. The core caches it per (settings,
// language, units), so the texts are localized in the language it asks for.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from './config.js';
import { idsOf } from './devices.js';
import { MESSAGES, NAMES, TEXT, formatNumber } from './i18n.js';

export const WIDGET_KEY = 'station';

/** Seconds the core keeps a content: the age row moves by the minute. */
const TTL_SECONDS = 120;

/** The tiles, in order. */
const TILES = ['temperature', 'humidity', 'wind_speed', 'rain_today'];

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const message = (text) => ({ ttl_seconds: TTL_SECONDS, components: [{ type: 'text', text }] });

/**
 * The widget content.
 * @param {object} options
 * @param {import('./hub.js').Hub} options.hub
 * @param {object} options.gladys
 * @param {{ station?: string }} [options.settings]
 * @param {string} [options.language]
 */
export function buildStationContent({ hub, gladys, settings = {}, language = 'en' }) {
  const lang = LANGUAGES.includes(language) ? language : 'en';
  let record;
  if (settings.station) {
    record = hub.recordByDevice(settings.station);
    if (!record) {
      return message(TEXT.unknownStation[lang]);
    }
  } else {
    record = hub.configuredRecords().find((candidate) => hub.isCreated(candidate));
    if (!record) {
      return message(TEXT.noStation[lang]);
    }
  }
  const ids = idsOf(gladys, record.code);
  // Only the features of the device as created in Gladys: a measure learnt
  // since then waits for "Update" in the Discovery tab.
  const created = new Set(
    (hub.createdDevice(record)?.features ?? []).map((feature) => feature.external_id),
  );
  const tiles = TILES.filter((key) => created.has(ids.feature(key))).map((key) => ({
    type: 'value',
    label: NAMES[lang][key],
    device_feature: ids.feature(key),
  }));

  const minutes = hub.ageMinutes(record);
  const stale = hub.isStale(record);
  const values = record.values;
  const n = (value) => formatNumber(value, lang);
  const items = [];
  if (!stale && typeof values.temperature_max === 'number') {
    const low = typeof values.temperature_min === 'number' ? ` / ${n(values.temperature_min)}` : '';
    items.push({
      label: TEXT.highLow[lang],
      value: clip(`${n(values.temperature_max)}${low} °C`, 40),
      color: WIDGET_COLORS.NEUTRAL,
      icon: 'thermometer',
    });
  }
  if (!stale && typeof values.wind_max === 'number') {
    items.push({
      label: TEXT.windMax[lang],
      value: `${n(values.wind_max)} km/h`,
      color: values.wind_max >= 60 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.NEUTRAL,
      icon: 'wind',
    });
  }
  items.push({
    label: TEXT.reading[lang],
    value:
      minutes === null ? TEXT.noData[lang] : clip(MESSAGES.readingAgo(minutes, stale)[lang], 40),
    color: stale ? WIDGET_COLORS.WARNING : WIDGET_COLORS.NEUTRAL,
    icon: 'clock',
  });

  return {
    ttl_seconds: TTL_SECONDS,
    components: [
      ...tiles,
      { type: 'status', items },
      {
        type: 'text',
        variant: 'caption',
        text: clip(`${hub.nameOf(record)} · ${TEXT.source[lang]}`, 200),
      },
    ],
  };
}
