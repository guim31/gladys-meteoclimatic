// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a simulated Meteoclimatic, a
// store in memory, a clock, and the integration wired on top
// (registerHandlers).
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { MemoryStore } from '../../src/store.js';
import { createNetwork, freshStations } from './network.js';

// The integration logs its lifecycle; keep the test output readable
// (LOG_LEVEL is read on every log call). LOG_LEVEL=debug npm test shows them.
process.env.LOG_LEVEL ??= 'silent';

/** The test clock starts here (the evening the fixtures were taken). */
export const START = Date.parse('2026-10-24T19:30:00Z');

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {string[]} [options.stations] station fixtures served fresh, by code (not configured by default)
 * @param {object} [options.feeds] more feeds, merged over the stations
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {Array} [options.houses] houses of Gladys
 * @param {object} [options.store] persistence (MemoryStore by default)
 * @param {boolean} [options.connect]
 */
export async function createWorld({
  config = {},
  stations = [],
  feeds = {},
  devices = [],
  houses = [],
  store = new MemoryStore(),
  connect = true,
} = {}) {
  const clock = { now: START };
  const now = () => clock.now;
  const network = createNetwork({ feeds: { ...freshStations(stations), ...feeds }, now });
  const gladys = createFakeGladys({ config, devices, houses });
  const app = registerHandlers(gladys, { store, fetch: network.fetch, timers: false, now });
  if (connect) {
    await gladys.connect();
  }
  return {
    gladys,
    app,
    network,
    store,
    clock,
    hub: app.hub,
    /** Move the clock forward. */
    advance(ms) {
      clock.now += ms;
    },
    /** Move the clock forward by minutes, one timer cycle per minute. */
    async run(minutes) {
      for (let i = 0; i < minutes; i += 1) {
        clock.now += 60_000;
        await app.poller.cycle();
      }
    },
  };
}

/** Add every discovered device to Gladys, as the user would. */
export async function createAll(world) {
  for (const device of world.gladys.fake.discoveredDevices) {
    await world.gladys.fake.deviceCreated(device);
  }
}

/** The discovered device of a station. */
export function discovered(world, code) {
  const id = world.gladys.externalIds('station', code).device;
  return world.gladys.fake.discoveredDevices.find((device) => device.external_id === id);
}
