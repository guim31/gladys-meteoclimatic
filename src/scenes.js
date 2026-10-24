// -----------------------------------------------------------------------------
// Scene action "Get the station readings" (Gladys 5.1+).
//
// Gives a scene the last reading of one station (the first added one when
// none is chosen), as outputs a notification can quote: "{{...summary}}"
// reads "Meteoclimatic Arenys de Mar · 14,8 °C · 82 % · Vent 0 km/h · Pluie du
// jour 2 mm · il y a 3 min". The devices already give each value to the scene
// conditions; what this action adds is a ready-made sentence, and the values
// of a station in one step.
//
// The triggers are fired by the hub (src/hub.js, src/triggers.js).
// -----------------------------------------------------------------------------

import { MESSAGES, TEXT } from './i18n.js';

export const GET_READINGS = 'get_readings';

/**
 * @param {import('./hub.js').Hub} hub
 * @param {{ station?: string }} fields
 * @param {string} language
 */
export function getReadings(hub, fields, language) {
  const created = hub.configuredRecords().filter((record) => hub.isCreated(record));
  const record = fields.station
    ? created.find((candidate) => candidate === hub.recordByDevice(fields.station))
    : created[0];
  const minutes = hub.ageMinutes(record);
  if (!record || minutes === null) {
    throw new Error(MESSAGES.thrown(TEXT.noReading));
  }
  const stale = hub.isStale(record);
  // A stale reading gives no value: only its age and the sentence say it.
  const values = stale ? {} : record.values;
  const outputs = {
    station: hub.nameOf(record),
    temperature: values.temperature ?? null,
    temperature_max: values.temperature_max ?? null,
    temperature_min: values.temperature_min ?? null,
    humidity: values.humidity ?? null,
    pressure: values.pressure ?? null,
    wind_speed: values.wind_speed ?? null,
    wind_max: values.wind_max ?? null,
    rain_today: values.rain_today ?? null,
    age_minutes: minutes,
    online: !stale,
    summary: MESSAGES.summary({ name: hub.nameOf(record), values, minutes, stale })[language],
  };
  // A measure the station does not have is left out (null for the scene).
  return Object.fromEntries(Object.entries(outputs).filter(([, value]) => value !== null));
}
