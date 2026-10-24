// -----------------------------------------------------------------------------
// The widget, the scene action and the Configuration buttons.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createAll, createWorld, discovered } from './helpers/world.js';
import { BARCELONA, MADRID, NO_RAIN_GAUGE, feed } from './helpers/network.js';
import { TEXT } from '../src/i18n.js';

const HOUSE = { selector: 'home', name: 'Maison', latitude: 41.39, longitude: 2.17 };

test('the widget: live tiles bound to existing features, the day high/low, the age, the credit', async () => {
  const w = await createWorld({
    stations: [BARCELONA, NO_RAIN_GAUGE],
    config: { stations: `${BARCELONA},${NO_RAIN_GAUGE}` },
  });
  const empty = await w.gladys.fake.widgetGet('station', { settings: {}, language: 'fr' });
  assert.equal(empty.data.content.components[0].text, TEXT.noStation.fr);
  await createAll(w);
  for (const code of [BARCELONA, NO_RAIN_GAUGE]) {
    for (const language of ['en', 'fr', 'de', 'es']) {
      const device = discovered(w, code);
      const {
        data: { content: data },
      } = await w.gladys.fake.widgetGet('station', {
        settings: { station: device.external_id },
        language,
      });
      validateWidgetContent(data);
      const texts = data.components.filter((c) => c.type === 'text');
      assert.ok(data.components.length <= 8 && texts.length <= 2);
      const features = new Set(device.features.map((f) => f.external_id));
      for (const tile of data.components.filter((c) => c.type === 'value')) {
        assert.ok(features.has(tile.device_feature), tile.device_feature);
      }
    }
  }
  const {
    data: { content: data },
  } = await w.gladys.fake.widgetGet('station', { settings: {}, language: 'fr' });
  const status = data.components.find((c) => c.type === 'status');
  assert.deepEqual(
    status.items.map((i) => `${i.label}: ${i.value}`),
    ['Max. / min.: 20,1 / 12,9 °C', 'Vent max.: 21 km/h', 'Relevé: il y a 5 min'],
  );
  assert.equal(
    data.components.at(-1).text,
    'Meteoclimatic Arenys de Mar · Données : Meteoclimatic (CC BY-NC-ND)',
  );
  const gone = await w.gladys.fake.widgetGet('station', {
    settings: { station: 'ext:x:y' },
    language: 'es',
  });
  assert.equal(gone.data.content.components[0].text, TEXT.unknownStation.es);
});

test('the scene action: the values and a sentence, in the configured language', async () => {
  const w = await createWorld({
    stations: [BARCELONA, MADRID],
    config: { stations: `${BARCELONA},${MADRID}`, language: 'es' },
  });
  const none = await w.gladys.fake.sceneAction('get_readings', {});
  assert.equal(none.success, false);
  await createAll(w);
  const {
    data: { outputs: data },
  } = await w.gladys.fake.sceneAction('get_readings', {
    station: discovered(w, MADRID).external_id,
  });
  assert.equal(data.station, 'Meteoclimatic Alcorcón');
  assert.equal(data.temperature, 15.2);
  assert.equal(data.wind_max, 31);
  assert.equal(data.online, true);
  assert.equal(
    data.summary,
    'Meteoclimatic Alcorcón · 15,2 °C · 47 % · Viento 8 km/h SO · Lluvia del día 0 mm · hace 5 min',
  );
  const first = await w.gladys.fake.sceneAction('get_readings', {});
  assert.equal(first.data.outputs.station, 'Meteoclimatic Arenys de Mar');
});

test('find_nearby lists the stations around the house, with their codes', async () => {
  const w = await createWorld({
    houses: [HOUSE],
    feeds: { ES: feed('network-ES'), PT: feed('network-PT'), AD: feed('network-AD') },
  });
  const {
    data: { message: data },
  } = await w.gladys.fake.action('find_nearby', { radius_km: '50' });
  assert.match(data.fr, /station\(s\) à moins de 50 km de « Maison »/);
  assert.match(data.fr, /ESCAT0800000008350A · Arenys de Mar \(Barcelona\) · \d+,?\d* km/);
  assert.doesNotMatch(data.fr, /ESMAD/);
  const far = await w.gladys.fake.action('find_nearby', { radius_km: '5' });
  assert.match(far.data.message.en, /No station online within 5 km/);
  const noHouse = await createWorld({ houses: [{ selector: 'x', name: 'X' }] });
  const refused = await noHouse.gladys.fake.action('find_nearby', {});
  assert.equal(refused.success, false);
});

test('check_stations: one line per station, zones and wrong codes told apart', async () => {
  const w = await createWorld({
    stations: [BARCELONA],
    feeds: { ESCAT08: feed('zone-ESCAT08') },
    config: { stations: `${BARCELONA}, ESCAT08, ESXXX00000000000Z, n'importe` },
  });
  const {
    data: { message: data },
  } = await w.gladys.fake.action('check_stations', {});
  assert.deepEqual(data.fr.split('\n'), [
    'ESCAT0800000008350A Arenys de Mar : il y a 5 min',
    "ESCAT08 : c'est une zone, pas une station. Utilisez la recherche, ou le code d'une de ses stations.",
    "ESXXX00000000000Z : aucun relevé récent (station hors ligne depuis plus d'une heure, ou code erroné)",
    "Ignoré, ce n'est pas un code de station : n'importe.",
  ]);
});
