// -----------------------------------------------------------------------------
// The scene triggers of one station, as transitions.
//
// Scene filters only compare for equality (a threshold belongs to a device
// feature), so a trigger with a threshold fires once per threshold crossed,
// and the scene author picks one (required filter).
//
// Meteoclimatic gives the rain of the day and the strongest wind of the day,
// not the instant values: the triggers read their increases.
//
// The totals restart at local midnight: a reading of a new local day
// compares with 0, a drop within the day (a station restart) fires nothing.
//
// `rain_started` — the rain of the day grows after 30 minutes without
//   growing: once per rain episode.
// `rain_stopped` — a reading N minutes after the last growth still shows
//   none, after rain: once per dry spell and per threshold.
// `gust_above` — the strongest wind of the day passes N km/h: once per day
//   and per threshold.
// `station_silent` — no new reading for N minutes: once per silence and per
//   threshold.
// `station_back` — a new reading after a silence of an hour at least, seen
//   while running.
//
// After a restart, the first reading is a baseline: rain already falling or a
// wind already strong fires nothing (it would run every scene again).
// -----------------------------------------------------------------------------

export const TRIGGER = {
  RAIN_STARTED: 'rain_started',
  RAIN_STOPPED: 'rain_stopped',
  GUST_ABOVE: 'gust_above',
  STATION_SILENT: 'station_silent',
  STATION_BACK: 'station_back',
};

/** Rain growing again within this delay is the same episode. */
export const QUIET_PERIOD_MS = 30 * 60 * 1000;

/** A station silent at least this long is "back" with its next reading. */
export const BACK_AFTER_MS = 60 * 60 * 1000;

// Thresholds offered to the scene author (the stations upload every 10 minutes).
export const DRY_MINUTES = [30, 60, 120, 180];
export const GUST_THRESHOLDS_KMH = [30, 40, 50, 60, 70, 80, 90, 100, 120];
export const SILENT_MINUTES = [60, 120, 240, 720];

const MINUTE = 60 * 1000;

/** The local day of a time, in the container's time zone (Gladys injects TZ). */
export function localDay(ms) {
  const date = new Date(ms);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * @param {object} options
 * @param {number | null} [options.lastReadingAt] the last reading known (from /data)
 * @param {number} options.startedAt when the tracker starts (the container's clock)
 * @param {(ms: number) => string} [options.dayOf] the local day of a time
 */
export function createTriggerTracker({ lastReadingAt = null, startedAt, dayOf = localDay }) {
  let baseline = false;
  let day = null;
  let lastRain = null;
  let lastRainAt = null;
  let dryFired = new Set();
  let lastWindMax = null;
  let readingAt = lastReadingAt;
  // A silence already long at start-up is not announced again.
  let silentFired = null;
  let silenceSeen = false;

  /**
   * The values crossed upwards by a daily total since the last reading: the
   * station restarts its totals at local midnight, so a new day starts
   * from 0; a drop within the day (a station restart) only moves the base.
   */
  function rise(previous, value, newDay) {
    const before = newDay ? 0 : previous;
    return before === null ? null : { before, after: value };
  }

  return {
    /**
     * A new reading of the station.
     * @param {{ measuredAt: number, values: Record<string, number> }} reading
     * @returns {{ rainStarted: boolean, gusts: number[], backAfterMinutes: number | null }}
     */
    onReading({ measuredAt, values }) {
      const previousAt = readingAt;
      readingAt = measuredAt;
      // Only a silence seen while running: a restart of the container after
      // a while is not the station coming back.
      const backAfterMinutes =
        silenceSeen && previousAt !== null ? Math.floor((measuredAt - previousAt) / MINUTE) : null;
      silenceSeen = false;
      silentFired = new Set();
      const rain = values.rain_today ?? null;
      const windMax = values.wind_max ?? null;
      const readingDay = dayOf(measuredAt);
      const newDay = day !== null && readingDay !== day;
      day = readingDay;
      if (!baseline) {
        baseline = true;
        lastRain = rain;
        lastWindMax = windMax;
        // Rain already in the day's total fell before: when, nobody knows,
        // so no dry spell is counted until the total grows again.
        return { rainStarted: false, gusts: [], backAfterMinutes };
      }

      let rainStarted = false;
      if (rain !== null) {
        const change = rise(lastRain, rain, newDay);
        if (change && change.after > change.before) {
          rainStarted = lastRainAt === null || measuredAt - lastRainAt >= QUIET_PERIOD_MS;
          lastRainAt = measuredAt;
          dryFired = new Set();
        }
        lastRain = rain;
      }

      const gusts = [];
      if (windMax !== null) {
        const change = rise(lastWindMax, windMax, newDay);
        for (const threshold of GUST_THRESHOLDS_KMH) {
          if (change && change.before <= threshold && change.after > threshold) {
            gusts.push(threshold);
          }
        }
        lastWindMax = windMax;
      }
      return { rainStarted, gusts, backAfterMinutes };
    },

    /**
     * The clock ticked: dry spells and silences.
     * @param {number} now
     * @param {{ serviceDown?: boolean }} [options] serviceDown: Meteoclimatic
     *   itself does not answer, so no silence can be blamed on the station
     * @returns {{ dry: number[], silent: number[], silentMinutes: number | null }}
     */
    onTick(now, { serviceDown = false } = {}) {
      // A dry spell is confirmed by a reading, not by the clock alone: a
      // station that went silent after rain says nothing about the rain.
      const dry = [];
      if (lastRainAt !== null && readingAt !== null) {
        for (const minutes of DRY_MINUTES) {
          if (!dryFired.has(minutes) && readingAt - lastRainAt >= minutes * MINUTE) {
            dryFired.add(minutes);
            dry.push(minutes);
          }
        }
      }
      if (readingAt === null || serviceDown) {
        return { dry, silent: [], silentMinutes: null };
      }
      const silentMinutes = Math.floor((now - readingAt) / MINUTE);
      if (now - Math.max(readingAt, startedAt) >= BACK_AFTER_MS) {
        silenceSeen = true;
      }
      const reached = SILENT_MINUTES.filter((minutes) => now - readingAt >= minutes * MINUTE);
      if (silentFired === null) {
        silentFired = new Set(reached);
        return { dry, silent: [], silentMinutes };
      }
      const silent = reached.filter((minutes) => !silentFired.has(minutes));
      for (const minutes of silent) {
        silentFired.add(minutes);
      }
      return { dry, silent, silentMinutes };
    },
  };
}
