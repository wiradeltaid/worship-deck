# WorshipDeck

> Suite locale de présentation et de régie de culte (local-first) qui transforme le déroulement du service en diapositives prêtes à l'emploi — génère des diaporamas PowerPoint (.pptx) hors ligne avec polices intégrées, une console pupitre double écran pour vidéoprojecteur et une télécommande pour smartphone via Wi-Fi local.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.id/worship-deck) | [Download for Windows](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

> **Avis de traduction :** Ce fichier est une traduction de [README.md](README.md) fournie uniquement à titre indicatif. En cas de divergence ou de conflit d'interprétation, la version officielle en langue anglaise (`README.md`) prévaut. L'ensemble de la documentation technique approfondie et des documents juridiques est maintenu en anglais.

Conçu pour les assemblées chrétiennes et les cultes liturgiques. Les modèles de diapositives sont gérés comme des données éditables plutôt que du code figé, permettant à toute paroisse de les adapter directement depuis son navigateur.

## Problématique Résolue

Préparer manuellement les diapositives de culte prend chaque semaine 2 à 4 heures, principalement consacrées à ressaisir des paroles de cantiques déjà enregistrées par le passé. Un changement d'hymne de dernière minute contraint à refaire l'ensemble du diaporama, et le savoir-faire technique repose souvent sur un seul bénévole.

WorshipDeck lit le déroulement préparé par les responsables de culte et génère automatiquement des diapositives impeccablement structurées.

```text
texte du programme  →  analyse du culte  →  plan de diapositives  →  ┬→  PowerPoint hors ligne (.pptx)
                                                                     ├→  diaporama Web plein écran
                                                                     └→  console pupitre + vidéoprojecteur
```

Les paroles des cantiques sont indexées directement par numéro depuis la base de données locale. La disposition des modèles s'édite directement dans le navigateur via un registre SQLite. Une fois le fichier PowerPoint téléchargé, aucune connexion Internet n'est requise lors de la célébration, garantissant un culte sans interruption même en cas de panne réseau.

## Fonctionnalités Principales

- **Import automatique du programme :** Collez le texte brut ou transmettez-le par webhook sécurisé. Les lignes non reconnues restent visibles sans être ignorées.
- **Découpage des strophes et refrains :** Les cantiques référencés par numéro sont automatiquement scindés en titre, strophes et refrains récurrents.
- **Éditeur visuel de modèles (WYSIWYG) :** 38 modèles intégrés modifiables directement sur le canevas : repositionnement, redimensionnement et polices personnalisées.
- **Une disposition pour quatre affichages (16:9 large) :** Une structure de données unique alimente PowerPoint, affichage Web, projecteur et aperçu en direct à l'échelle 1:1.
- **Mode régie double écran :** Diapositives actuelle et suivante, pellicule miniature, déroulé du culte et fenêtre indépendante à glisser vers le projecteur.
- **Fonction écran noir (Blank Screen) :** Masquez instantanément l'affichage du projecteur sans perdre votre position de lecture (`B`).
- **Transitions au choix :** Coupure, fondu, dissolution et glissement appliqués à l'identique sur le Web et dans PowerPoint.
- **Affichage direct de passages bibliques :** Projetez des versets bibliques (KJV) pendant la prédication et masquez-les d'un clic.
- **Annonces paroissiales :** Gestion des affiches et avis paroissiaux depuis les fichiers locaux ou des adresses approuvées.
- **Intégration de polices personnalisées :** Intégration ECMA-376 assurant un rendu parfait sur n'importe quel ordinateur doté de Microsoft PowerPoint.
- **Gestion des accès :** Séparation des comptes administrateur et opérateur, limitation du débit de connexion contre les attaques par force brute.
- **Analyse du programme et mise en page de formulaire configurables :** Créez des profils d'analyse nommés et organisez les champs/groupes du formulaire de Service depuis le panneau d'administration, sans toucher au code.
- **Bibliothèque de médias :** Un ensemble réutilisable d'images de fond et d'affiches, indépendant de tout modèle.
- **Synchronisation manuelle entre appareils** *(expérimental — pas encore vérifié entre deux machines réelles)* : Envoyez et récupérez les Services, les entrées Song Set, les fonds et les annonces entre deux instances de WorshipDeck sur le même réseau local, à la demande. Sans cloud, sans synchronisation en arrière-plan.

## Prérequis Système

- **Application de Bureau :** Windows 10/11 64 bits.
- **Compilation depuis les Sources :** Go 1.24+ et Node.js 22+. Utilise SQLite intégré sans serveur de base de données externe.

## Guide d'Installation

### Installateur Windows (Recommandé)

Téléchargez `WorshipDeckSetup.exe` depuis la [page officielle des versions](https://github.com/wiradeltaid/worship-deck/releases) et suivez l'assistant d'installation.

> **Remarque concernant Windows SmartScreen :** Cette version n'étant pas encore signée avec un certificat EV commercial coûteux, Windows SmartScreen peut afficher un avertissement. Cliquez sur **« Informations complémentaires »** puis sur **« Exécuter quand même »**.

### Exécution depuis les Sources

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck
npm install
npm run setup
npm run dev
```

`npm run setup` génère le fichier `.env`, initialise la base de données SQLite, enregistre les modèles par défaut et affiche le mot de passe administrateur généré. `npm run dev` démarre l'API Go sur <http://localhost:3000> et le SPA React sur <http://localhost:5173> (Vite redirige `/api` vers Go). Connectez-vous en tant que `admin` sur le SPA. Pour une seule origine : `npm run spa:build && npm start` puis ouvrez le port 3000. Relancer `setup` est sans risque : il n'écrase jamais un `.env` ou une base de données existants.

Lisez [`.constitution/project/private-data.md`](.constitution/project/private-data.md) avant d'y saisir les données de votre propre paroisse.

### Créer un service

**Services → Nouveau.** Collez un déroulement de culte dans la zone de texte brut. La forme attendue ressemble à ceci (noms fictifs) :

```text
SABBATH, MARCH 14, 2026

BIBLE TALK (09.30-10.50 /80 min)
》welcome remarks: Mrs. Lestari
Song Leader : Ms. Ayu
[  ] Opening song : SDAH #159 The Old Rugged Cross
Memory Verse & Opening Prayer : Mr. Bagas
Closing Prayer : Mr. Damar (1m)

DIVINE SERVICE (10.50- 12.05/ 75 min)
Song Leader : Ms. Kirana
[  ] Opening Song : SDAH #83 O Worship the King
Intercessory Prayer: Mr. Farid (5m)
Sermon : Pr. Andi Hartono "Working Out" (45m)
[  ] Closing Song : SDAH #249 Praise Him! Praise Him!
```

Cliquez sur **Analyser**. Les rôles, horaires et numéros de cantiques sont extraits dans le formulaire ; les cantiques sont résolus en titres depuis le corpus local. Tout ce que l'analyseur n'a pas su placer est listé plutôt qu'ignoré.

Complétez l'affiche de la prédication et les photos famille/jeunesse si vous en avez, puis enregistrez.

### Diffuser le culte

Depuis la page du service :

- **Télécharger le PPTX** — le diaporama hors ligne. C'est celui qui maintient le culte si le réseau, l'ordinateur portable ou le serveur vous fait défaut.
- **Piloter** — la console pupitre. Diapositive actuelle et suivante, pellicule miniature, liste des diapositives et **Toutes les diapositives** pour sauter n'importe où.
- **Ouvrir le projecteur** — une fenêtre séparée à glisser vers le second écran. Les flèches font avancer les deux. `B` masque le projecteur et le restaure.

### Fonctionnalités complémentaires

**Consultation biblique.** Le mode pupitre peut afficher un passage KJV sur le projecteur. Le corpus est fourni dans `data/en/bible-translation/kjv.json` et réconcilié depuis ce fichier à chaque démarrage.

**Import par chat.** `POST /api/webhook` avec un en-tête `x-webhook-secret` accepte un déroulement en JSON, permettant à un bot de créer ou corriger un service. Le secret vit dans `.env` ; le point d'entrée n'est protégé que par lui, jamais par une session.

### Dépannage

**`Missing song book corpus`** — `data/song-book/sdah.json` est absent. Il est fourni avec le dépôt, donc restaurez-le depuis le contrôle de version : `git checkout -- data/song-book/sdah.json`. Puis lancez `npm run corpus:verify` pour confirmer que les deux corpus sont complets.

**Verrouillé** — `npm run auth:set-password -- admin` définit un nouveau mot de passe via une invite interactive. `npm run auth:unlock -- --list` affiche et réinitialise la limitation des tentatives de connexion.

**Images manquantes dans le diaporama** — les images distantes doivent respecter les règles de sécurité d'URL. Le téléversement direct vers le serveur fonctionne toujours.

## Se l'approprier

Le registre fourni est un exemple fonctionnel — un déroulement de culte réel avec des coordonnées et informations de paiement fictives. Deux choses à modifier :

1. **Modèles de diapositives.** Connectez-vous en tant qu'administrateur et ouvrez `/admin/artifacts`. Chaque modèle est modifiable sur un canevas ; les diapositives fixes (offrande, prière du milieu de semaine, contact) sont l'endroit où placer vos propres informations.
2. **Substitutions privées.** Si vous préférez garder le registre de votre paroisse entièrement hors de git, placez-le dans `data/local/default-registry.json` et l'application s'initialisera à partir de ce fichier à la place. Ce chemin est ignoré par git. Voir [`.constitution/project/private-data.md`](.constitution/project/private-data.md).

## Corpus fournis

Deux corpus par défaut sont inclus, de sorte qu'un clone résout un numéro de cantique et une référence biblique sans aucun fichier fourni séparément et sans réseau au démarrage :

| Fichier | Contenu | Au démarrage |
| --- | --- | --- |
| `data/song-book/sdah.json` | 695 cantiques du recueil Adventiste du Septième Jour | titre et paroles réappliqués depuis le fichier |
| `data/en/bible-translation/kjv.json` | 66 livres, 1189 chapitres, 31102 versets KJV | réconcilié depuis le fichier fourni à chaque démarrage (~130–150 ms mesurés) |

`npm run corpus:verify` vérifie que les deux sont intacts. Aucun des deux n'a de générateur : les exports dont ils proviennent n'existent plus, ces fichiers constituent donc la source de référence — restaurez-les depuis le contrôle de version plutôt que de les reconstruire.

Lisez [ATTRIBUTIONS.md](ATTRIBUTIONS.md) — il nomme les détenteurs des droits d'auteur, précise l'usage paroissial non commercial et fournit un contact pour les demandes de retrait. Chaque corpus porte également son propre texte de licence dans le fichier.

Si vous adaptez ceci pour un autre recueil, ajoutez votre corpus dans `data/song-book/<book-code>.json` selon la même forme. Les cantiques sont indexés par `(book_code, number)`, donc un second recueil se place à côté de celui fourni au lieu de le remplacer.

## Déploiement

Compilez l'API Go et le SPA, exécutez `./api` (ou `npm start`) sur un hôte avec Node 22 dans `PATH` pour le worker PPTX — voir [`.constitution/project/deployment.md`](.constitution/project/deployment.md). SQLite, les images téléversées et le cache des diaporamas nécessitent tous des chemins d'hôte durables ; ce fichier précise lesquels.

## Historique du projet

Ce projet a débuté comme un dépôt privé pour une seule paroisse. Cet historique n'a pas été repris ici, car il contenait de vrais noms de membres, des photographies de personnes identifiables y compris des mineurs, des captures d'écran de messages privés et un code de paiement actif — rien de tout cela n'avait sa place dans un dépôt public, et rien de tout cela ne peut être dépublié une fois indexé.

Ce dépôt démarre donc à partir d'un commit initial unique avec une paroisse d'exemple fictive. La raison pour laquelle le système est conçu ainsi se trouve dans `.what/` et `.how/` (DEC-001).

Contributeurs : merci de lire [`.constitution/project/private-data.md`](.constitution/project/private-data.md) avant votre premier commit. Un test échoue si des données de paroisse atteignent un fichier suivi par git, et il est là pour une bonne raison.

## Licence et Droit des Marques

- **Licence du Code :** Distribué sous [Licence MIT](LICENSE).
- **Recueils de Cantiques & Attributions :** Les recueils de chants, traductions bibliques et attributions tierces sont détaillés dans [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
- **Confidentialité & Sécurité :** Aucun backend cloud et zéro télémétrie — chaque requête reste sur votre machine ou le réseau local de votre église. La seule fonctionnalité qui communique avec un autre hôte est la Synchronisation Manuelle, et cet hôte est une autre instance de WorshipDeck que vous exploitez vous-même, jointe uniquement à l'initiative d'un opérateur (voir [PRIVACY.md](PRIVACY.md) et [SECURITY.md](SECURITY.md)).
- **Nom et Marque :** La licence MIT accorde des droits sur le code source, mais n'accorde aucun droit sur les noms ou logos. Les noms **WorshipDeck** et **Wira Delta Indonesia**, ainsi que l'icône du produit, restent la propriété exclusive de PT Wira Delta Indonesia.
