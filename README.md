# Meteoclimatic for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) external integration for
[Meteoclimatic](https://www.meteoclimatic.net/), the network of more than
1,500 amateur weather stations in Spain, Portugal and Andorra: the readings
of the stations you choose, as Gladys devices, with a dashboard widget, scene
triggers and a scene action.

For the official forecasts and observations of the Spanish weather agency,
see [gladys-aemet](https://github.com/guim31/gladys-aemet); this integration
gives the readings of the volunteer stations of the network, often closer to
home.

This integration is not affiliated with Meteoclimatic.

## What it does

- **One device per station**, read from its public RSS feed (no account, no
  key): temperature, high and low of the day, humidity, pressure, wind,
  strongest wind of the day, wind direction, rain of the day, and the age of
  the reading. Only the measures the station has.
- **Find stations near a house**: the stations online around a house of
  Gladys, nearest first, with the codes to copy.
- **Widget** "Meteoclimatic station": live tiles, high/low of the day,
  strongest wind, reading age, and the credit of the source.
- **Scene triggers**: it starts raining, the rain stops (after 30 min to 3 h),
  strong wind (30 to 120 km/h), station silent (1 to 12 h), station back.
- **Scene action** "Station readings": the values and a ready-made sentence.
- Texts in English, French, German and Spanish.

The user documentation, shown in Gladys, is in [`docs/`](docs/en.md)
([fr](docs/fr.md), [de](docs/de.md), [es](docs/es.md)).

## Requirements

- Gladys Assistant 5.2.0 or later.
- Internet access to `www.meteoclimatic.net`.
- For the nearby search: the location of the house, in Settings → Houses.

## Installation

In Gladys, open **Integrations → Install from GitHub** and enter
`https://github.com/guim31/gladys-meteoclimatic`. Then fill the Configuration
tab: see [the documentation](docs/en.md#configuration).

## Respect of the service

Meteoclimatic is run by volunteers. The integration:

- reads a station **every 10 minutes at most** (15 by default; the stations
  upload about every 10 minutes), 10 stations at most, one after the other;
- reads only the stations whose device was added to Gladys (and, once, the
  ones it does not know yet, to list them in the Discovery tab);
- reads the three network feeds (about 2 MB) only when the user clicks "Find
  stations near a house";
- sends a `User-Agent` naming the integration and this repository.

The data is published under the
[CC BY-NC-ND 3.0](https://creativecommons.org/licenses/by-nc-nd/3.0/)
licence: the integration shows it unchanged, and the widget credits
Meteoclimatic.

## Limits

- Amateur stations: siting and calibration vary, and a station can stop for
  days. The integration says so (reading age, "station silent" trigger)
  rather than showing old values as recent.
- The feeds give the rain and the strongest wind **of the day**, not the
  instant rain rate nor the current gust: the triggers follow their increases.
- A station that has not uploaded for about an hour disappears from the feeds,
  exactly like an unknown code: the two cannot be told apart.

## Development

```bash
npm install
npm run format:check   # Prettier
npm run lint           # ESLint
npm test               # node --test, against the SDK's fake Gladys
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests never touch the network: they replay feeds recorded from the live
service (`test/fixtures/feeds`, stations of Barcelona, Madrid and Valencia).
The architecture and the rules of the project are in [`CLAUDE.md`](CLAUDE.md).

## Credits

- Data: [Meteoclimatic](https://www.meteoclimatic.net/) and the owners of its
  stations, CC BY-NC-ND 3.0.
- The same feeds are read by the Home Assistant
  [`meteoclimatic`](https://www.home-assistant.io/integrations/meteoclimatic/)
  integration, through the
  [pymeteoclimatic](https://github.com/adrianmo/pymeteoclimatic) library: the
  idea comes from there. The parser of this integration was written from the
  live feeds; no code was copied.
- Built on the official
  [integration template](https://github.com/GladysAssistant/integration-template-js)
  and the [integration SDK](https://github.com/GladysAssistant/integration-sdk-js)
  of Gladys Assistant.
- Cover: the Meteoclimatic logo, from its website, used to name the service.

## License

[Apache 2.0](LICENSE). The data read by the integration stays under the
licence of Meteoclimatic.
