# Meteoclimatic

Les relevés des stations météo amateurs de
[Meteoclimatic](https://www.meteoclimatic.net/), un réseau de plus de 1 500
stations en Espagne, au Portugal et en Andorre : température, humidité,
pression, vent et pluie du jour, rafraîchis toutes les 10 à 15 minutes.

Les données appartiennent à Meteoclimatic et aux propriétaires des stations,
sous licence CC BY-NC-ND 3.0 : l'intégration les montre telles quelles, et le
widget cite la source. Cette intégration n'est pas affiliée à Meteoclimatic.
Pour les prévisions et observations officielles en Espagne, voir l'intégration
AEMET.

## Ce que fait l'intégration

- Lit les **stations que vous choisissez** par leur code, sans compte ni clé.
- Crée **un appareil par station** : température, max. et min. du jour,
  humidité, pression, vent, vent max. du jour, direction du vent, pluie du
  jour, et l'âge du relevé. Une station sans pluviomètre ou sans anémomètre
  n'a simplement pas la fonctionnalité correspondante.
- Trouve les **stations autour de votre maison**, avec leur distance.
- Ajoute un widget **Station Meteoclimatic**, cinq déclencheurs de scène
  (début de pluie, fin de pluie, vent fort, station muette, retour de la
  station) et une action de scène **Relevés de la station**.

Lecture seule : l'intégration ne modifie jamais rien sur une station.

## Prérequis

- Gladys Assistant **5.2.0** ou plus récent.
- Un accès à Internet (les flux publics de meteoclimatic.net).
- Pour la recherche autour de la maison : la position de votre maison,
  renseignée dans **Paramètres → Maisons**. L'intégration demande l'accès aux
  coordonnées de la maison sur l'écran d'installation ; elle ne s'en sert que
  pour cette recherche.

## Configuration

### Choisir les stations

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. Cliquez sur **Trouver les stations autour d'une maison** : choisissez la
   maison (vide : la première maison située) et un rayon (vide : 10 km). Le
   résultat liste les stations en ligne, de la plus proche à la plus
   lointaine, avec leur code, leur nom, leur province et leur distance.
3. Copiez les codes voulus dans **Stations**, séparés par des virgules (10 au
   plus). Le code termine aussi l'adresse de la page d'une station sur le
   site : `https://www.meteoclimatic.net/perfil/ESCAT0800000008350A` ;
   l'adresse complète est acceptée aussi.
4. Enregistrez, puis ouvrez l'onglet **Découverte** et ajoutez les stations.

Un code de zone (`ESCAT08`, une province) n'est pas une station : **Vérifier
les stations** le signale.

### Autres réglages

- **Fréquence de lecture** : toutes les 10, 15 (par défaut), 30 ou 60
  minutes. Les stations envoient leurs relevés toutes les 10 minutes environ,
  et Meteoclimatic est un réseau bénévole : l'intégration ne lit jamais plus
  vite, une station à la fois.
- **Langue** : langue des noms de fonctionnalités, fixés à l'ajout d'un
  appareil (renommez-les dans Gladys si vous changez d'avis ensuite), et des
  textes de scène.

**Vérifier les stations** lit chaque station maintenant et indique l'âge de
son dernier relevé.

## Appareils

### Station

Un appareil par station, au nom de la station (« Meteoclimatic Arenys de
Mar ») :

| Fonctionnalité                | Unité | Remarques                                    |
| ----------------------------- | ----- | -------------------------------------------- |
| Température                   | °C    |                                              |
| Température max./min. du jour | °C    | depuis minuit local, comme la station compte |
| Humidité                      | %     |                                              |
| Pression                      | hPa   | telle que la station la publie               |
| Vent                          | km/h  | le vent actuel de la station                 |
| Vent max. du jour             | km/h  | le vent le plus fort de la journée           |
| Direction du vent             | °     | 0 = nord, 90 = est                           |
| Pluie du jour                 | mm    | depuis minuit local                          |
| Âge du relevé                 | min   | minutes depuis le dernier relevé             |

Les fonctionnalités sont celles que la station envoie : une station sans
pluviomètre n'a pas de « Pluie du jour ». Elles sont apprises de ses données
et conservées.

### Âge du relevé

Meteoclimatic ne liste une station que si elle a envoyé un relevé depuis une
heure environ. Au-delà de 60 minutes sans nouveau relevé, les valeurs ne sont
plus envoyées à Gladys (elles auraient l'air récentes) : seul l'**âge du
relevé** continue d'augmenter, et le widget montre la station hors ligne.

## Widget

**Station Meteoclimatic** : la température, l'humidité, le vent et la pluie du
jour en tuiles en direct, les max. et min. du jour, le vent max. (en orange
dès 60 km/h) et l'âge du relevé, avec la mention de la source. Réglage : la
station (vide : la première station ajoutée).

## Scènes

### Déclencheurs

Chaque déclencheur a un filtre **Station**, et donne le nom de la station en
variable.

- **Meteoclimatic : il commence à pleuvoir** : la pluie du jour augmente
  après 30 minutes sans augmenter. Une fois par épisode de pluie. Variable :
  pluie du jour (mm).
- **Meteoclimatic : la pluie s'arrête** : la pluie du jour n'augmente plus
  depuis 30 minutes, 1, 2 ou 3 heures, après de la pluie. Une fois par
  accalmie et par durée. Variable : pluie du jour (mm).
- **Meteoclimatic : vent fort** : le vent max. du jour dépasse 30, 40…
  120 km/h. Une fois par jour et par seuil. Variable : vent max. (km/h).
- **Meteoclimatic : station muette** : plus de nouveau relevé depuis 1, 2, 4
  ou 12 heures. Variable : minutes sans relevé.
- **Meteoclimatic : retour de la station** : un nouveau relevé après un
  silence d'une heure au moins. Variable : minutes sans relevé.

Meteoclimatic donne la pluie et le vent max. **du jour**, pas les valeurs
instantanées : les déclencheurs suivent leurs hausses, au rythme des relevés
(10 minutes au mieux). Après un redémarrage de l'intégration, le premier
relevé sert de référence : une pluie déjà tombée ou un vent fort déjà mesuré
ne déclenchent rien.

### Action : Relevés de la station

Donne le dernier relevé d'une station (vide : la première station ajoutée) :
température, max. et min. du jour, humidité, pression, vent, vent max., pluie
du jour, âge, en ligne ou non, et une phrase toute faite : « Meteoclimatic
Arenys de Mar · 14,8 °C · 82 % · Vent 12 km/h SO · Pluie du jour 2 mm · il y
a 3 min ». Une station hors ligne ne donne que son âge.

## Exemples de scènes

- **Rentrer le store quand le vent se lève** : déclencheur « Meteoclimatic :
  vent fort », au-delà de 50 km/h → fermer le store, envoyer un message.
- **Pas d'arrosage après la pluie** : déclencheur « Meteoclimatic : il
  commence à pleuvoir » → désactiver la scène d'arrosage pour la journée ;
  déclencheur « la pluie s'arrête » après 3 heures → la réactiver.
- **Message météo du matin** : tous les jours à 7 h → action « Meteoclimatic :
  relevés de la station » → envoyer `{{summary}}` sur votre téléphone.

## Dépannage

- **Rien dans l'onglet Découverte** : la station n'a rien envoyé depuis plus
  d'une heure, ou le code est erroné. **Vérifier les stations** dit lequel, et
  la page de la station sur meteoclimatic.net montre son dernier relevé.
- **« C'est une zone, pas une station »** : utilisez **Trouver les stations
  autour d'une maison** ou le code à la fin de la page d'une station.
- **La recherche ne trouve rien** : Meteoclimatic couvre l'Espagne, le
  Portugal et l'Andorre ; essayez un rayon plus grand.
- **« Meteoclimatic ne répond pas »** : le site est en panne ou injoignable
  depuis Gladys ; les relevés reprennent d'eux-mêmes.
- **Logs détaillés** : définissez `LOG_LEVEL=debug` sur le conteneur de
  l'intégration.

## Limites

- Des stations amateurs, entretenues par des bénévoles : leur emplacement et
  leur étalonnage varient, une valeur peut être fausse, et une station peut
  s'arrêter plusieurs jours.
- La pluie et le vent max. sont ceux du jour (remis à zéro à minuit local par
  la station), pas l'intensité de pluie instantanée ni la rafale du moment.
- La pression est celle que publie la station : en général ramenée au niveau
  de la mer, parfois celle de la station (une station de montagne affiche
  alors environ 850 hPa).
- Les positions sont arrondies à deux décimales (environ un kilomètre) : les
  distances sont approximatives.
- Les flux ne donnent ni historique d'humidité ou de pression, ni UV, ni
  rayonnement solaire.
- Données sous licence CC BY-NC-ND 3.0 : usage personnel, non commercial, en
  citant la source.
