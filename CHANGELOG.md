# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- One device per Meteoclimatic station: temperature, high and low of the day,
  humidity, pressure, wind, strongest wind of the day, wind direction, rain of
  the day and reading age, for the measures the station has.
- "Find stations near a house" lists the stations online around a house of
  Gladys, with their codes and distances; "Check the stations" tells how old
  each station's last reading is, and spots zone codes and wrong codes.
- The stations are read every 10 to 60 minutes (15 by default), one after the
  other, by the integration's own timer.
- Scene triggers: it starts raining, the rain stops, strong wind, station
  silent, station back.
- Scene action "Station readings", with a ready-made sentence for messages.
- Dashboard widget "Meteoclimatic station", crediting the source (CC BY-NC-ND).
- Feature names, messages and documentation in English, French, German and
  Spanish.

[Unreleased]: https://github.com/guim31/gladys-meteoclimatic/commits/main
