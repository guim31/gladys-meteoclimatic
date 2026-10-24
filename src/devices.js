// -----------------------------------------------------------------------------
// The Gladys devices: one per Meteoclimatic station.
//
// External ids (forever, see CLAUDE.md):
//   station : ext:<selector>:station:<code>     features :temperature, :humidity...
//
// The features of a station are the measures it ever sent (a station without
// rain gauge has no rain feature): learnt from the data, kept under /data,
// never removed. Plus :age, the minutes since the reading, always there.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { NAMES } from './i18n.js';

const SENSOR = TYPES.SENSOR;

const temperature = {
  category: CATEGORIES.TEMPERATURE_SENSOR,
  type: SENSOR.DECIMAL,
  unit: UNITS.CELSIUS,
  min: -50,
  max: 60,
};
const speed = {
  category: CATEGORIES.SPEED_SENSOR,
  type: SENSOR.DECIMAL,
  unit: UNITS.KILOMETER_PER_HOUR,
  min: 0,
  max: 250,
};

// The Gladys couple of each measure, in display order. min/max are display
// bounds (Gladys never clamps a state with them).
export const FEATURES = {
  temperature,
  temperature_max: temperature,
  temperature_min: temperature,
  humidity: {
    category: CATEGORIES.HUMIDITY_SENSOR,
    type: SENSOR.DECIMAL,
    unit: UNITS.PERCENT,
    min: 0,
    max: 100,
  },
  // Some stations publish the station pressure, not the sea-level one: a
  // mountain station reads 850 hPa.
  pressure: {
    category: CATEGORIES.PRESSURE_SENSOR,
    type: SENSOR.DECIMAL,
    unit: UNITS.HECTO_PASCAL,
    min: 500,
    max: 1100,
  },
  wind_speed: speed,
  wind_max: speed,
  wind_direction: {
    category: CATEGORIES.ANGLE_SENSOR,
    type: SENSOR.INTEGER,
    unit: UNITS.DEGREE,
    min: 0,
    max: 360,
  },
  rain_today: {
    category: CATEGORIES.PRECIPITATION_SENSOR,
    type: SENSOR.DECIMAL,
    unit: UNITS.MILLIMETER_PER_DAY,
    min: 0,
    max: 500,
  },
  // A week shown on the scale; an older reading still gets its real age.
  age: {
    category: CATEGORIES.DURATION,
    type: TYPES.DURATION.INTEGER,
    unit: UNITS.MINUTES,
    min: 0,
    max: 10080,
  },
};

/** The measures, in display order. */
export const MEASURES = Object.keys(FEATURES).filter((key) => key !== 'age');

/** Feature key of the reading age. */
export const AGE_KEY = 'age';

/**
 * The external ids of a station's device.
 * @param {object} gladys
 * @param {string} code
 */
export function idsOf(gladys, code) {
  return gladys.externalIds('station', code);
}

/** The device name: the station's name on Meteoclimatic, never translated. */
export function deviceName(record) {
  return record.name ? `Meteoclimatic ${record.name}` : `Meteoclimatic ${record.code}`;
}

/**
 * The discovery payload of one station.
 * @param {object} gladys
 * @param {{ code: string, name?: string, features: string[] }} record
 * @param {string} language language of the feature names
 */
export function buildDevice(gladys, record, language) {
  const names = NAMES[language] ?? NAMES.fr;
  const ids = idsOf(gladys, record.code);
  const keys = [...MEASURES.filter((key) => record.features.includes(key)), AGE_KEY];
  return {
    name: deviceName(record),
    external_id: ids.device,
    model: 'Meteoclimatic',
    // The container reads the stations itself (src/poller.js). These two
    // fields only keep the core's onPoll as a fallback: once a minute, the
    // slowest pace Gladys schedules, skipped while the container's timer runs.
    should_poll: true,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
    features: keys.map((key) => ({
      name: names[key],
      external_id: ids.feature(key),
      ...FEATURES[key],
      read_only: true,
      has_feedback: false,
      keep_history: true,
    })),
    params: [{ name: 'station_code', value: record.code }],
  };
}
