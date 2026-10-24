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
// `rain_started` — the rain of the day grows after 30 minutes without
//   growing (or restarts from a new day): once per rain episode.
// `rain_stopped` — the rain of the day stopped growing N minutes ago, after
//   rain: once per dry spell and per threshold.
// `gust_above` — the strongest wind of the day passes N km/h: once per day
//   and per threshold (the day's maximum only grows).
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

/**
 * @param {object} options
 * @param {number | null} [options.lastReadingAt] the last reading known (from /data)
 */
export function createTriggerTracker({ lastReadingAt = null } = {}) {
  let baseline = false;
  let lastRain = null;
  let lastRainAt = null;
  let dryFired = new Set();
  let lastWindMax = null;
  let readingAt = lastReadingAt;
  // A silence already long at start-up is not announced again.
  let silentFired = null;
  let silenceSeen = false;

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
        // Growing, or a new day that already has rain (the total restarted).
        const fell = lastRain === null ? false : rain > lastRain || (rain < lastRain && rain > 0);
        if (fell) {
          rainStarted = lastRainAt === null || measuredAt - lastRainAt >= QUIET_PERIOD_MS;
          lastRainAt = measuredAt;
          dryFired = new Set();
        }
        lastRain = rain;
      }

      const gusts = [];
      if (windMax !== null) {
        // The maximum of the day only grows: lower means a new day, from 0.
        const before = lastWindMax === null ? windMax : windMax < lastWindMax ? 0 : lastWindMax;
        for (const threshold of GUST_THRESHOLDS_KMH) {
          if (before <= threshold && windMax > threshold) {
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
     * @returns {{ dry: number[], silent: number[], silentMinutes: number | null }}
     */
    onTick(now) {
      const dry = [];
      if (lastRainAt !== null) {
        for (const minutes of DRY_MINUTES) {
          if (!dryFired.has(minutes) && now - lastRainAt >= minutes * MINUTE) {
            dryFired.add(minutes);
            dry.push(minutes);
          }
        }
      }
      if (readingAt === null) {
        return { dry, silent: [], silentMinutes: null };
      }
      const silentMinutes = Math.floor((now - readingAt) / MINUTE);
      if (now - readingAt >= BACK_AFTER_MS) {
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
