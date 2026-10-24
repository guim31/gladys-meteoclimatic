// -----------------------------------------------------------------------------
// The stations the integration reads, what it knows about them, and what it
// publishes to Gladys.
//
// Reading a station updates its "record" (name, position, measures, last
// reading), persisted under /data; the record gives the Gladys device
// (src/devices.js) and its states.
//
// Freshness: the feed of a station empties when it stopped uploading for
// about an hour. Its last values are then NOT published again: a value
// Gladys shows as recent is a recent reading. Only the reading age keeps
// moving, so a scene or the widget can tell a silent station.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { ApiError, fetchStation } from './api.js';
import { AGE_KEY, MEASURES, buildDevice, deviceName, idsOf } from './devices.js';
import { createIssueLog } from './issues.js';
import { createTriggerTracker, TRIGGER } from './triggers.js';

const logger = createLogger({ name: 'stations' });

/** Past this age, a reading is stale: not published, and the widget says so. */
export const STALE_MINUTES = 60;

/** An unchanged value is published again this often (Gladys: "no recent value" past 48 h). */
export const STATE_HEARTBEAT_MS = 6 * 60 * 60 * 1000;

const STORE_VERSION = 1;

export class Hub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {() => object} options.getConfig the current normalized config
   * @param {{ load: Function, save: Function }} options.store
   * @param {typeof fetch} [options.fetch]
   * @param {() => number} [options.now]
   */
  constructor({ gladys, getConfig, store, fetch, now = () => Date.now() }) {
    this.gladys = gladys;
    this.getConfig = getConfig;
    this.store = store;
    this.deps = { fetch };
    this.now = now;
    /** Record by station code. */
    this.records = new Map();
    /** Trigger tracker by station code. */
    this.trackers = new Map();
    /** Set when the device list must be published again (new station, new measure). */
    this.devicesChanged = false;
    /** Set when the widget content changed (new reading, freshness). */
    this.widgetChanged = false;
    /** Stations whose values must all be sent again (back from silence). */
    this.resend = new Set();
    /** Scene events waiting for the publication of their station's states. */
    this.pendingEvents = new Map();
    /** Outcome of the last read of each station: { ok, error?, zone?, at }. */
    this.lastResults = new Map();
    this.issues = createIssueLog(logger);
    this.persistNeeded = false;
  }

  async load() {
    const data = await this.store.load();
    if (data.version !== STORE_VERSION) {
      return;
    }
    for (const record of data.records ?? []) {
      if (record && typeof record.code === 'string' && Array.isArray(record.features)) {
        record.values ??= {};
        this.records.set(record.code, record);
      }
    }
  }

  persist() {
    return this.store.save({ version: STORE_VERSION, records: [...this.records.values()] });
  }

  /** The records of the configured stations, in configuration order. */
  configuredRecords(config = this.getConfig()) {
    return config.stations.map((code) => this.records.get(code)).filter(Boolean);
  }

  /** The record behind a device external id, among the configured ones. */
  recordByDevice(externalId, config = this.getConfig()) {
    return this.configuredRecords(config).find(
      (record) => idsOf(this.gladys, record.code).device === externalId,
    );
  }

  /** The discovery payload: one device per configured station read at least once. */
  buildDevices(config = this.getConfig()) {
    return this.configuredRecords(config).map((record) =>
      buildDevice(this.gladys, record, config.language),
    );
  }

  /** The device of a record in Gladys, undefined when the user did not add it. */
  createdDevice(record) {
    const external = idsOf(this.gladys, record.code).device;
    return (this.gladys.devices ?? []).find((device) => device.external_id === external);
  }

  isCreated(record) {
    return Boolean(this.createdDevice(record));
  }

  /** The name the user gave the device in Gladys, else ours. */
  nameOf(record) {
    return this.createdDevice(record)?.name || deviceName(record);
  }

  /** Minutes since the last reading, null when there never was one. */
  ageMinutes(record) {
    if (!record?.measuredAt) {
      return null;
    }
    return Math.max(0, Math.floor((this.now() - record.measuredAt) / 60_000));
  }

  isStale(record) {
    const minutes = this.ageMinutes(record);
    return minutes === null || minutes > STALE_MINUTES;
  }

  trackerOf(record) {
    let tracker = this.trackers.get(record.code);
    if (!tracker) {
      tracker = createTriggerTracker({
        lastReadingAt: record.measuredAt ?? null,
        startedAt: this.now(),
      });
      this.trackers.set(record.code, tracker);
    }
    return tracker;
  }

  /**
   * Read one station and publish what changed. Throws the read error (the
   * poller logs it), after recording it for the check action.
   * @param {string} code
   */
  async refresh(code) {
    let result;
    try {
      result = await fetchStation(code, this.deps);
      this.issues.ok('api', 'Meteoclimatic answers again');
    } catch (err) {
      this.lastResults.set(code, { ok: false, error: err.message, at: this.now() });
      if (err instanceof ApiError) {
        this.issues.fail('api', err.message);
      }
      throw err;
    }
    this.lastResults.set(code, { ok: true, zone: result.zone, at: this.now() });
    let record = this.records.get(code);
    if (!result.station) {
      if (result.zone) {
        this.issues.fail(`zone:${code}`, `${code} is a zone, not a station: not read`);
      } else if (!record) {
        this.issues.fail(`missing:${code}`, `${code}: no reading (offline, or a wrong code)`);
      }
      if (record) {
        this.watchFreshness(record);
        await this.publishStates(record);
      }
      return record;
    }
    const { station } = result;
    const isNew = !record;
    record ??= { code, features: [], values: {}, measuredAt: null };
    for (const key of ['name', 'province', 'latitude', 'longitude']) {
      if (station[key] !== null && record[key] !== station[key]) {
        record[key] = station[key];
        this.persistNeeded = true;
      }
    }
    const added = this.learnFeatures(record, Object.keys(station.values));
    if (isNew) {
      this.records.set(code, record);
      this.devicesChanged = true;
      this.issues.ok(`missing:${code}`, `${code}: readings again`);
      logger.info(
        `Station ${code} found: ${station.name} (${Object.keys(station.values).join(', ')})`,
      );
    } else if (added.length > 0) {
      logger.info(`Station ${code} also measures ${added.join(', ')}`);
    }
    this.applyReading(record, station);
    logger.debug(`${code}: ${JSON.stringify(station.values)}`);
    await this.publishStates(record);
    return record;
  }

  /**
   * Add the measures a station never sent before. Never removes one: a
   * feature is an external id Gladys keeps.
   * @returns {string[]} the added keys
   */
  learnFeatures(record, measures) {
    const added = measures.filter(
      (key) => MEASURES.includes(key) && !record.features.includes(key),
    );
    if (added.length > 0) {
      record.features.push(...added);
      this.devicesChanged = true;
      this.persistNeeded = true;
    }
    return added;
  }

  /** A newer reading: keep it, evaluate the scene triggers. */
  applyReading(record, station) {
    if (
      station.measuredAt === null ||
      (record.measuredAt && station.measuredAt <= record.measuredAt)
    ) {
      this.watchFreshness(record);
      return;
    }
    if (this.isStale(record)) {
      // Back from silence: every value goes out again, even an unchanged one,
      // so Gladys dates it now.
      this.resend.add(record.code);
    }
    const tracker = this.trackerOf(record);
    record.values = station.values;
    record.measuredAt = station.measuredAt;
    this.persistNeeded = true;
    this.widgetChanged = true;
    this.watchFreshness(record);

    const { rainStarted, gusts, backAfterMinutes } = tracker.onReading(station);
    const events = this.pendingEvents.get(record.code) ?? [];
    if (backAfterMinutes !== null) {
      events.push({ key: TRIGGER.STATION_BACK, data: { silent_minutes: backAfterMinutes } });
    }
    if (rainStarted) {
      events.push({
        key: TRIGGER.RAIN_STARTED,
        data: { rain_today_mm: station.values.rain_today ?? null },
      });
    }
    for (const threshold of gusts) {
      events.push({
        key: TRIGGER.GUST_ABOVE,
        data: { above_kmh: String(threshold), wind_max_kmh: station.values.wind_max },
      });
    }
    if (events.length > 0) {
      this.pendingEvents.set(record.code, events);
    }
  }

  /** Log (once) a station that went silent, and its return. */
  watchFreshness(record) {
    const key = `stale:${record.code}`;
    const stale = this.isStale(record);
    if (stale !== this.issues.isFailing(key)) {
      this.widgetChanged = true;
    }
    if (stale && record.measuredAt) {
      this.issues.fail(key, `${deviceName(record)}: no reading for ${this.ageMinutes(record)} min`);
    } else if (!stale) {
      this.issues.ok(key, `${deviceName(record)}: readings again`);
    }
  }

  /**
   * The clock ticked (once a minute): dry spells and silences of the stations
   * added to Gladys.
   */
  async tick() {
    for (const record of this.configuredRecords()) {
      // While Meteoclimatic itself is down, no station is blamed for the silence.
      const { dry, silent, silentMinutes } = this.trackerOf(record).onTick(this.now(), {
        serviceDown: this.issues.isFailing('api'),
      });
      if (!this.isCreated(record)) {
        continue;
      }
      for (const minutes of dry) {
        await this.fireScene(record, TRIGGER.RAIN_STOPPED, {
          after_minutes: String(minutes),
          rain_today_mm: record.values.rain_today ?? null,
        });
      }
      for (const minutes of silent) {
        await this.fireScene(record, TRIGGER.STATION_SILENT, {
          after_minutes: String(minutes),
          silent_minutes: silentMinutes,
        });
      }
    }
  }

  async fireScene(record, key, extra) {
    const device = idsOf(this.gladys, record.code).device;
    try {
      await this.gladys.publishSceneEvent(key, {
        device,
        station: this.nameOf(record),
        ...extra,
      });
      logger.debug(`Scene event ${key} fired for ${record.code}`);
      this.issues.ok('scene', 'Gladys accepts the scene events again');
    } catch (err) {
      this.issues.fail('scene', `Firing the scene event ${key} failed: ${err.message}`);
    }
  }

  /**
   * Publish the states of a station whose device exists in Gladys: its
   * values while they are fresh, and always its age. Only the changes go out
   * (the SDK deduplicates), plus a heartbeat. Then its scene events.
   * @param {object} record
   * @param {{ force?: boolean }} [options] force: the device was just added
   */
  async publishStates(record, { force = false } = {}) {
    const events = this.pendingEvents.get(record.code) ?? [];
    this.pendingEvents.delete(record.code);
    if (!this.isCreated(record)) {
      return;
    }
    const ids = idsOf(this.gladys, record.code);
    if (force || this.resend.has(record.code)) {
      this.resend.delete(record.code);
      this.gladys.forgetPublishedStates(ids.device);
    }
    const states = [];
    const minutes = this.ageMinutes(record);
    if (minutes !== null && !this.isStale(record)) {
      for (const key of record.features) {
        const value = record.values[key];
        if (typeof value === 'number') {
          states.push({
            device_feature_external_id: ids.feature(key),
            state: key === 'wind_direction' ? Math.round(value) : value,
          });
        }
      }
    }
    if (minutes !== null) {
      states.push({ device_feature_external_id: ids.feature(AGE_KEY), state: minutes });
    }
    try {
      if (states.length > 0) {
        await this.gladys.publishChangedStates(states, { heartbeat: STATE_HEARTBEAT_MS });
        this.issues.ok('publish', 'Gladys accepts the states again');
      }
    } catch (err) {
      this.issues.fail('publish', `Publishing the states failed: ${err.message}`);
    } finally {
      // The events of the reading go out even when its states could not.
      for (const event of events) {
        await this.fireScene(record, event.key, event.data);
      }
    }
  }

  /** Forget the records of the stations no longer configured. */
  prune(config = this.getConfig()) {
    for (const code of [...this.records.keys()]) {
      if (!config.stations.includes(code)) {
        this.records.delete(code);
        this.trackers.delete(code);
        this.persistNeeded = true;
      }
    }
  }

  /** Persist if anything changed since the last save. */
  async save() {
    if (this.persistNeeded) {
      this.persistNeeded = false;
      await this.persist();
    }
  }
}
