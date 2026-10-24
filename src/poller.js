// -----------------------------------------------------------------------------
// The container's own polling timer.
//
// The devices are published with `should_poll: true` and a valid
// `poll_frequency`, but the core cannot be trusted to call onPoll: Gladys
// 5.2.x skips devices created without `should_poll`, and a device keeps the
// polling fields it was created with (GladysAssistant/Gladys#3198). So the
// container reads the stations by itself, and the core's onPoll is a fallback.
//
// Pace: every `refresh_minutes` (10 minutes at least, the pace of the
// stations). One timer ticks every minute: it reads the stations that are
// due, then lets the scene triggers count dry spells and silences. A station
// read less than 90 % of its period ago is skipped, whoever asks (timer or
// core), so the core's minute polls never add a request.
//
// What is read: the stations whose device the user added to Gladys, and the
// stations never read yet (their first reading tells what the device
// measures, for the Discovery tab). One after the other: a volunteer
// network, no burst.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { periodMs } from './config.js';

const logger = createLogger({ name: 'poller' });

/** The timer's tick. */
export const TICK_MS = 60_000;

/** A station read less than this share of its period ago is not read again. */
const MIN_GAP = 0.9;

/**
 * @param {object} options
 * @param {object} options.gladys
 * @param {import('./hub.js').Hub} options.hub
 * @param {() => object} options.getConfig
 * @param {() => Promise<void>} options.afterCycle publishes what the reads changed
 * @param {boolean} [options.timers] run the periodic timer (tests may turn it off)
 * @param {() => number} [options.now]
 */
export function createPoller({
  gladys,
  hub,
  getConfig,
  afterCycle = async () => {},
  timers = true,
  now = () => Date.now(),
}) {
  /** When each station was last read (start of the read), by code. */
  const lastReadAt = new Map();
  /** Reads in progress, by code: a second caller waits for the same one. */
  const inFlight = new Map();
  let timer = null;
  let stopped = true;

  /** The stations to read now: added to Gladys, or never read yet. */
  function wantedStations(config) {
    return config.stations.filter((code) => {
      const record = hub.records.get(code);
      return !record || hub.isCreated(record);
    });
  }

  /**
   * Read one station, unless it was read less than MIN_GAP of its period ago
   * (force: read anyway, after the read in progress if any).
   * @returns {Promise<boolean>} true when the station was read
   */
  async function readStation(code, { force = false } = {}) {
    let running = inFlight.get(code);
    while (running && force) {
      await running.catch(() => {});
      running = inFlight.get(code);
    }
    if (running) {
      await running.catch(() => {});
      return false;
    }
    const last = lastReadAt.get(code);
    if (!force && last !== undefined && now() - last < periodMs(getConfig()) * MIN_GAP) {
      logger.debug(`${code}: read ${Math.round((now() - last) / 1000)} s ago, skipped`);
      return false;
    }
    lastReadAt.set(code, now());
    const run = hub.refresh(code);
    inFlight.set(code, run);
    try {
      await run;
      return true;
    } catch (err) {
      // A feed error is logged once by the hub's issue log; the next read retries.
      logger.debug(`${code}: ${err.message}`);
      return true;
    } finally {
      inFlight.delete(code);
    }
  }

  /** One cycle: the wanted stations in sequence, then the triggers' clock. */
  async function cycle({ force = false, codes } = {}) {
    if (gladys.connected === false) {
      logger.debug('Gladys unreachable: cycle skipped');
      return;
    }
    for (const code of codes ?? wantedStations(getConfig())) {
      await readStation(code, { force });
    }
    await afterCycle();
    await hub.tick();
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!timers || stopped) {
      return;
    }
    timer = setTimeout(async () => {
      timer = null;
      try {
        await cycle();
      } catch (err) {
        logger.error(`Polling cycle failed (${err.message})`);
      } finally {
        schedule();
      }
    }, TICK_MS);
  }

  return {
    /**
     * (Re)start: read the wanted stations not read lately, then on the
     * timer. Not forced: a flapping link to Gladys must not turn into
     * bursts of requests to a volunteer network.
     */
    async restart() {
      stopped = false;
      schedule();
      await cycle();
    },

    /** One timer cycle (tests). */
    cycle,

    /**
     * The core's onPoll (fallback): read the device's station unless it was
     * read recently.
     * @param {{ external_id: string }} device
     */
    async pollFromCore(device) {
      const record = hub.recordByDevice(device.external_id);
      if (!record) {
        logger.debug(`onPoll ignored (not a configured station): ${device.external_id}`);
        return;
      }
      if (await readStation(record.code)) {
        await afterCycle();
      }
    },

    /**
     * Read some stations now (a device just added, the check action), unless
     * they were read less than `maxAgeMs` ago.
     */
    async refreshNow(codes, { maxAgeMs = 0 } = {}) {
      const due = codes.filter((code) => {
        const last = lastReadAt.get(code);
        return last === undefined || now() - last >= maxAgeMs;
      });
      if (due.length > 0) {
        await cycle({ force: true, codes: due });
      }
    },

    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
    },
  };
}
