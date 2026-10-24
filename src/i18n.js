// -----------------------------------------------------------------------------
// Every text the integration shows to the user, in the four languages of the
// Gladys interface (en, fr, de, es). German says "du", Spanish says "usted",
// like the rest of guim31's integrations. The vocabulary follows the Gladys
// interface (front/src/config/i18n).
//
//   - NAMES    : the feature names, in the language of the configuration
//                (Gladys freezes a name when the device is created);
//   - TEXT     : fixed texts (widget, statuses);
//   - MESSAGES : texts built from values (action results, errors).
//
// test/i18n.test.js checks that every entry carries the four languages.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';

/** Feature names, by language then measure. */
export const NAMES = {
  en: {
    temperature: 'Temperature',
    temperature_max: "Today's high",
    temperature_min: "Today's low",
    humidity: 'Humidity',
    pressure: 'Pressure',
    wind_speed: 'Wind',
    wind_max: "Today's strongest wind",
    wind_direction: 'Wind direction',
    rain_today: 'Rain today',
    age: 'Reading age',
  },
  fr: {
    temperature: 'Température',
    temperature_max: 'Température max. du jour',
    temperature_min: 'Température min. du jour',
    humidity: 'Humidité',
    pressure: 'Pression',
    wind_speed: 'Vent',
    wind_max: 'Vent max. du jour',
    wind_direction: 'Direction du vent',
    rain_today: 'Pluie du jour',
    age: 'Âge du relevé',
  },
  de: {
    temperature: 'Temperatur',
    temperature_max: 'Tageshöchstwert',
    temperature_min: 'Tagestiefstwert',
    humidity: 'Luftfeuchtigkeit',
    pressure: 'Luftdruck',
    wind_speed: 'Wind',
    wind_max: 'Stärkster Wind heute',
    wind_direction: 'Windrichtung',
    rain_today: 'Regen heute',
    age: 'Alter der Messung',
  },
  es: {
    temperature: 'Temperatura',
    temperature_max: 'Máxima del día',
    temperature_min: 'Mínima del día',
    humidity: 'Humedad',
    pressure: 'Presión',
    wind_speed: 'Viento',
    wind_max: 'Viento máximo del día',
    wind_direction: 'Dirección del viento',
    rain_today: 'Lluvia del día',
    age: 'Antigüedad de la lectura',
  },
};

/** Fixed texts. */
export const TEXT = {
  // Widget
  source: {
    en: 'Data: Meteoclimatic (CC BY-NC-ND)',
    fr: 'Données : Meteoclimatic (CC BY-NC-ND)',
    de: 'Daten: Meteoclimatic (CC BY-NC-ND)',
    es: 'Datos: Meteoclimatic (CC BY-NC-ND)',
  },
  highLow: {
    en: 'High / low',
    fr: 'Max. / min.',
    de: 'Max. / Min.',
    es: 'Máx. / mín.',
  },
  windMax: {
    en: 'Strongest wind',
    fr: 'Vent max.',
    de: 'Stärkster Wind',
    es: 'Viento máx.',
  },
  reading: {
    en: 'Reading',
    fr: 'Relevé',
    de: 'Messung',
    es: 'Lectura',
  },
  noStation: {
    en: 'Add a station in the Discovery tab of the integration to see its readings here.',
    fr: "Ajoutez une station depuis l'onglet Découverte de l'intégration pour voir ici ses relevés.",
    de: 'Füge im Tab „Entdecken“ der Integration eine Station hinzu, um hier ihre Messwerte zu sehen.',
    es: 'Añada una estación desde la pestaña Descubrimiento de la integración para ver aquí sus lecturas.',
  },
  unknownStation: {
    en: 'This station is no longer read: pick another one in the widget settings.',
    fr: "Cette station n'est plus lue : choisissez-en une autre dans les réglages du widget.",
    de: 'Diese Station wird nicht mehr gelesen: wähle in den Einstellungen des Widgets eine andere.',
    es: 'Esta estación ya no se lee: elija otra en los ajustes del widget.',
  },
  noData: {
    en: 'No reading yet',
    fr: 'Aucun relevé pour l’instant',
    de: 'Noch keine Messung',
    es: 'Todavía no hay lectura',
  },

  // Configuration screen
  notConfigured: {
    en: 'Enter the codes of the stations to read, or search the stations near your house.',
    fr: 'Saisissez les codes des stations à lire, ou cherchez les stations autour de votre maison.',
    de: 'Gib die Codes der zu lesenden Stationen ein oder suche die Stationen um dein Haus.',
    es: 'Introduzca los códigos de las estaciones que desea leer, o busque las estaciones cercanas a su casa.',
  },
  apiUnreachable: {
    en: 'Meteoclimatic does not answer: the readings will resume on their own.',
    fr: "Meteoclimatic ne répond pas : les relevés reprendront d'eux-mêmes.",
    de: 'Meteoclimatic antwortet nicht: die Messungen laufen von selbst wieder an.',
    es: 'Meteoclimatic no responde: las lecturas se reanudarán por sí solas.',
  },
  initFailed: {
    en: 'Initialization failed, check the integration logs.',
    fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
    de: 'Die Initialisierung ist fehlgeschlagen, sieh dir die Logs der Integration an.',
    es: 'La inicialización ha fallado, consulte los registros de la integración.',
  },
  noHouse: {
    en: 'No house of Gladys has a location: set it in Settings → Houses.',
    fr: "Aucune maison de Gladys n'a de position : renseignez-la dans Paramètres → Maisons.",
    de: 'Kein Haus in Gladys hat einen Standort: lege ihn unter Einstellungen → Häuser fest.',
    es: 'Ninguna casa de Gladys tiene ubicación: indíquela en Ajustes → Casas.',
  },
  nothingConfigured: {
    en: 'Nothing to check: enter station codes first.',
    fr: "Rien à vérifier : saisissez d'abord des codes de stations.",
    de: 'Nichts zu prüfen: gib zuerst Stationscodes ein.',
    es: 'Nada que comprobar: introduzca primero códigos de estaciones.',
  },
  noReading: {
    en: 'No recent reading: the station is offline, or not added to Gladys.',
    fr: 'Aucun relevé récent : la station est hors ligne, ou pas ajoutée à Gladys.',
    de: 'Keine aktuelle Messung: die Station ist offline oder nicht zu Gladys hinzugefügt.',
    es: 'No hay lectura reciente: la estación está desconectada, o no se ha añadido a Gladys.',
  },
};

/** Multi-language object built by a function of the language. */
function build(render) {
  return Object.fromEntries(LANGUAGES.map((lang) => [lang, render(lang)]));
}

/**
 * A number written the way the language writes it (decimal comma in French,
 * German and Spanish).
 */
export function formatNumber(value, lang, decimals = 1) {
  return new Intl.NumberFormat(lang, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(value);
}

/** How long ago, in short words: "3 min", "2 h", "4 d". */
export function formatAge(minutes, lang) {
  const units = {
    en: ['min', 'h', 'd'],
    fr: ['min', 'h', 'j'],
    de: ['Min.', 'Std.', 'T.'],
    es: ['min', 'h', 'd'],
  }[lang];
  if (minutes < 120) {
    return `${Math.max(0, Math.round(minutes))} ${units[0]}`;
  }
  if (minutes < 48 * 60) {
    return `${Math.round(minutes / 60)} ${units[1]}`;
  }
  return `${Math.round(minutes / 1440)} ${units[2]}`;
}

const AGO = {
  en: (age) => `${age} ago`,
  fr: (age) => `il y a ${age}`,
  de: (age) => `vor ${age}`,
  es: (age) => `hace ${age}`,
};

const OFFLINE = {
  en: (age) => `Offline (${age})`,
  fr: (age) => `Hors ligne (${age})`,
  de: (age) => `Offline (${age})`,
  es: (age) => `Desconectada (${age})`,
};

/** The 16 compass points, by language. */
const COMPASS = {
  en: 'N NNE NE ENE E ESE SE SSE S SSW SW WSW W WNW NW NNW',
  fr: 'N NNE NE ENE E ESE SE SSE S SSO SO OSO O ONO NO NNO',
  de: 'N NNO NO ONO O OSO SO SSO S SSW SW WSW W WNW NW NNW',
  es: 'N NNE NE ENE E ESE SE SSE S SSO SO OSO O ONO NO NNO',
};

/** A direction in degrees as a compass point: 236 -> "SW". */
export function compassPoint(degrees, lang) {
  const points = COMPASS[lang].split(' ');
  return points[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];
}

/** Texts built from values. */
export const MESSAGES = {
  /** "3 min ago", or "Offline (2 h)" past the freshness limit. */
  readingAgo: (minutes, stale) =>
    build((lang) => (stale ? OFFLINE : AGO)[lang](formatAge(minutes, lang))),

  /** One-line summary of a reading, for notifications. */
  summary: ({ name, values, minutes, stale }) =>
    build((lang) => {
      const n = (value) => formatNumber(value, lang);
      const parts = [name];
      if (typeof values.temperature === 'number') {
        parts.push(`${n(values.temperature)} °C`);
      }
      if (typeof values.humidity === 'number') {
        parts.push(`${n(values.humidity)} %`);
      }
      if (typeof values.wind_speed === 'number') {
        const direction =
          typeof values.wind_direction === 'number' && values.wind_speed > 0
            ? ` ${compassPoint(values.wind_direction, lang)}`
            : '';
        parts.push(`${NAMES[lang].wind_speed} ${n(values.wind_speed)} km/h${direction}`);
      }
      if (typeof values.rain_today === 'number') {
        parts.push(`${NAMES[lang].rain_today} ${n(values.rain_today)} mm`);
      }
      parts.push(MESSAGES.readingAgo(minutes, stale)[lang]);
      return parts.join(' · ');
    }),

  invalidCodes: (codes) =>
    build((lang) => {
      const list = codes.join(', ');
      return {
        en: `Ignored, not a station code: ${list}.`,
        fr: `Ignoré, ce n'est pas un code de station : ${list}.`,
        de: `Ignoriert, kein Stationscode: ${list}.`,
        es: `Ignorado, no es un código de estación: ${list}.`,
      }[lang];
    }),

  tooMany: (max) =>
    build(
      (lang) =>
        ({
          en: `Only the first ${max} stations are read.`,
          fr: `Seules les ${max} premières stations sont lues.`,
          de: `Nur die ersten ${max} Stationen werden gelesen.`,
          es: `Solo se leen las ${max} primeras estaciones.`,
        })[lang],
    ),

  /** One line of the check report. */
  checkStation: ({ code, name, minutes, stale, error, zone }) =>
    build((lang) => {
      if (error) {
        return {
          en: `${code}: error (${error})`,
          fr: `${code} : erreur (${error})`,
          de: `${code}: Fehler (${error})`,
          es: `${code}: error (${error})`,
        }[lang];
      }
      if (zone) {
        return {
          en: `${code}: this is a zone, not a station. Use the search, or the code of one of its stations.`,
          fr: `${code} : c'est une zone, pas une station. Utilisez la recherche, ou le code d'une de ses stations.`,
          de: `${code}: Das ist eine Zone, keine Station. Nutze die Suche oder den Code einer ihrer Stationen.`,
          es: `${code}: es una zona, no una estación. Use la búsqueda, o el código de una de sus estaciones.`,
        }[lang];
      }
      if (minutes === null) {
        return {
          en: `${code}: no recent reading (station offline for over an hour, or a wrong code)`,
          fr: `${code} : aucun relevé récent (station hors ligne depuis plus d'une heure, ou code erroné)`,
          de: `${code}: keine aktuelle Messung (Station seit über einer Stunde offline oder falscher Code)`,
          es: `${code}: sin lectura reciente (estación desconectada desde hace más de una hora, o código erróneo)`,
        }[lang];
      }
      const colon = lang === 'fr' ? ' : ' : ': ';
      return `${code} ${name}${colon}${MESSAGES.readingAgo(minutes, stale)[lang]}`;
    }),

  /** Result of the nearby search. */
  nearby: ({ house, radiusKm, stations }) =>
    build((lang) => {
      const radius = formatNumber(radiusKm, lang);
      if (stations.length === 0) {
        return {
          en: `No station online within ${radius} km of "${house}": try a wider radius. Meteoclimatic covers Spain, Portugal and Andorra.`,
          fr: `Aucune station en ligne à moins de ${radius} km de « ${house} » : essayez un rayon plus grand. Meteoclimatic couvre l'Espagne, le Portugal et l'Andorre.`,
          de: `Keine Station online im Umkreis von ${radius} km um „${house}“: versuch einen größeren Radius. Meteoclimatic deckt Spanien, Portugal und Andorra ab.`,
          es: `No hay ninguna estación conectada a menos de ${radius} km de «${house}»: pruebe un radio mayor. Meteoclimatic cubre España, Portugal y Andorra.`,
        }[lang];
      }
      const lines = stations.map(
        (s) =>
          `${s.code} · ${s.name}${s.province ? ` (${s.province})` : ''} · ${formatNumber(s.distanceKm, lang)} km`,
      );
      const head = {
        en: `${stations.length} station(s) within ${radius} km of "${house}", nearest first:`,
        fr: `${stations.length} station(s) à moins de ${radius} km de « ${house} », de la plus proche à la plus lointaine :`,
        de: `${stations.length} Station(en) im Umkreis von ${radius} km um „${house}“, die nächste zuerst:`,
        es: `${stations.length} estación(es) a menos de ${radius} km de «${house}», de la más cercana a la más lejana:`,
      }[lang];
      const tail = {
        en: 'Copy the codes you want into "Stations".',
        fr: 'Copiez les codes voulus dans « Stations ».',
        de: 'Kopiere die gewünschten Codes in „Stationen“.',
        es: 'Copie los códigos deseados en «Estaciones».',
      }[lang];
      return [head, ...lines, tail].join('\n');
    }),

  /** A thrown error: the core shows it as is, so every language is joined. */
  thrown: (text) => LANGUAGES.map((lang) => text[lang]).join(' / '),
};
