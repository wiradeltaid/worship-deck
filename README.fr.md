# WorshipDeck

> Suite locale de présentation et de régie de culte (local-first) qui transforme le déroulement du service en diapositives prêtes à l'emploi: génère des diaporamas PowerPoint (.pptx) avec polices intégrées pour une utilisation hors ligne, une console pupitre double écran pour l'écran de l'assemblée et une télécommande pour smartphone via Wi-Fi local.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.id/worship-deck) | [Download for Windows](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

> **Avis de traduction :** Ce fichier est une traduction de [README.md](README.md) fournie uniquement à titre indicatif. En cas de divergence ou de conflit d'interprétation, la version officielle en langue anglaise (`README.md`) prévaut. L'ensemble de la documentation technique approfondie et des documents juridiques est maintenu en anglais.

Conçu pour les assemblées chrétiennes et les cultes liturgiques. Les mises en page de diapositives sont gérées comme des données configurables plutôt que du code figé, permettant à toute paroisse de les adapter directement depuis son navigateur.

## Problématique Résolue

Préparer manuellement les diapositives de culte prend chaque semaine 2 à 4 heures, principalement consacrées à ressaisir des paroles de cantiques déjà enregistrées par le passé. Un changement d'hymne de dernière minute contraint à refaire l'ensemble du diaporama, et le savoir-faire technique repose souvent sur un seul bénévole.

WorshipDeck lit le déroulement préparé par les responsables de culte depuis un message ou un formulaire et génère automatiquement des diapositives impeccablement structurées.

```text
texte du programme  ->  analyse du culte  ->  plan de diapositives  ->  +->  PowerPoint hors ligne (.pptx)
                                                                        +->  diaporama Web plein écran
                                                                        +->  console pupitre + écran de l'assemblée
```

Les paroles des cantiques sont indexées directement par numéro depuis la base de données locale. Les mises en page s'éditent directement dans le navigateur via un registre SQLite. Une fois le fichier PowerPoint téléchargé, aucune connexion Internet n'est requise lors de la célébration, garantissant un culte sans interruption même en cas de panne réseau.

## Fonctionnalités Principales

- **Import automatique du programme :** Collez le texte brut dans le formulaire Web. Les lignes non reconnues restent visibles sans être ignorées. (La réception par webhook sera disponible dans une prochaine version.)
- **Découpage des strophes et refrains :** Les cantiques référencés par numéro sont automatiquement scindés en titre, strophes et refrains récurrents.
- **Mises en page modifiables :** Gérez les mises en page dans un registre SQLite via un éditeur sur canevas dans le navigateur. Repositionnez et personnalisez les éléments, ou importez des présentations PowerPoint. Un ensemble optionnel de 38 exemples de mise en page est disponible via initialisation de démonstration.
- **Une disposition pour quatre affichages :** Une structure de données unique alimente PowerPoint, affichage Web, écran de l'assemblée et aperçu en direct au format 16:9 panoramique.
- **Mode régie double écran :** Diapositives actuelle et suivante, pellicule miniature, déroulé du culte, grille d'accès rapide et fenêtre indépendante pour l'écran de l'assemblée.
- **Fonction écran noir (Blank Screen) :** Masquez instantanément l'affichage de l'écran de l'assemblée sans perdre votre position de lecture (`B`).
- **Transitions au choix :** Coupure, fondu, dissolution et glissement appliqués à l'identique sur le Web et dans PowerPoint.
- **Affichage direct de passages bibliques :** Projetez des versets bibliques (KJV) pendant le culte et masquez-les d'un clic.
- **Annonces paroissiales :** Gestion des affiches et avis paroissiaux depuis les fichiers locaux ou des adresses approuvées.
- **Typographie personnalisée :** 35 familles de polices intégrées localement hors ligne, avec prise en charge de l'encapsulation ECMA-376 pour les polices personnalisées sous PowerPoint.
- **Gestion des accès :** Séparation des comptes administrateur et opérateur, limitation du débit de connexion et sessions révocables.
- **Mise en page et analyse dynamiques :** Configurez des champs prédéfinis avec des règles regex personnalisées et organisez les groupes de formulaires directement depuis le panneau d'administration.
- **Bibliothèque de médias :** Un ensemble réutilisable d'images de fond et d'affiches, indépendant de toute mise en page.
- **Synchronisation manuelle entre appareils (expérimental) :** Transférez services, listes de chants, fonds et annonces entre deux instances WorshipDeck sur le même réseau local, à la demande. Sans cloud, sans synchronisation en arrière-plan. Vérifié sur une seule machine; la synchronisation multi-machines demeure expérimentale.

## Prérequis Système

- **Installation sur Serveur (Recommandé) :** Linux (testé sous Ubuntu), Windows 10/11 ou environnement POSIX avec Go 1.24+ et Node.js 22.12+. Développé avec React 19. Utilise SQLite intégré sans serveur de base de données externe.
- **Application de Bureau Windows (Expérimental) :** Windows 10/11 64 bits.
- **macOS :** Non testé officiellement.

## Guide d'Installation

### Serveur Local Autonome (Recommandé)

L'exécution en tant que serveur local autonome constitue le modèle de déploiement principal et recommandé :

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck
npm install
npm run setup
npm run dev
```

`npm run setup` génère le fichier `.env` avec de nouveaux identifiants, initialise la base de données SQLite et affiche le mot de passe généré pour le compte `admin`. `npm run dev` lance l'API Go sur <http://localhost:3000> et l'application React sur <http://localhost:5173>. Connectez-vous en tant qu'`admin`. Pour une utilisation de production sur un port unique, exécutez `npm run spa:build && npm start` et ouvrez le port 3000.

Consultez [`.constitution/project/private-data.md`](.constitution/project/private-data.md) avant d'enregistrer des données paroissiales.

### Installateur pour Windows (Expérimental)

Téléchargez `WorshipDeck-0.1.0-x64-setup.exe` et `SHA256SUMS` depuis la [page officielle des versions](https://github.com/wiradeltaid/worship-deck/releases) et lancez l'assistant d'installation.

Vérifiez le fichier avant exécution : comparez l'empreinte SHA-256 calculée avec celle inscrite dans `SHA256SUMS`.

> **Note relative à Windows SmartScreen :** Cette version ne disposant pas encore d'un certificat commercial coûteux, Windows SmartScreen peut afficher un avertissement. Cliquez sur **Informations complémentaires** puis sur **Exécuter quand même**.

### Créer un Culte

Accédez à **Services -> New**. Collez le texte du déroulement dans la zone prévue. La structure attendue est la suivante :

```text
SABBATH, MARCH 14, 2026

BIBLE TALK (09.30-10.50 / 80 min)
>> welcome remarks: Mrs. Lestari
Song Leader : Ms. Ayu
[  ] Opening song : SDAH #159 The Old Rugged Cross
Memory Verse & Opening Prayer : Mr. Bagas
Closing Prayer : Mr. Damar (1m)

DIVINE SERVICE (10.50-12.05 / 75 min)
Song Leader : Ms. Kirana
[  ] Opening Song : SDAH #83 O Worship the King
Intercessory Prayer: Mr. Farid (5m)
Sermon : Pr. Andi Hartono "Working Out" (45m)
[  ] Closing Song : SDAH #249 Praise Him! Praise Him!
```

Cliquez sur **Baca susunan acara** (ou **Parse** en anglais). Les rôles, horaires et numéros de cantiques sont ventilés automatiquement dans le formulaire; les cantiques sont résolus à partir de la base locale. Les lignes non reconnues sont affichées pour vérification.

Ajoutez l'affiche du sermon et les photographies disponibles, puis enregistrez le culte.

### Présentation

Depuis la fiche du culte :

- **Télécharger PPTX :** Diaporama PowerPoint utilisable hors ligne pour pallier tout imprévu technique.
- **Présenter :** Console opérateur avec aperçu des diapositives, pellicule miniature et accès direct.
- **Ouvrir l'écran de l'assemblée :** Fenêtre indépendante sans commandes à déplacer sur le second affichage. Touche `B` pour écran noir.

### Options Complémentaires

**Recherche biblique :** Affichez un passage biblique de la version KJV sur l'écran de l'assemblée depuis `data/en/bible-translation/kjv.json`.

**Intégration par messagerie :** La réception de déroulements via webhook sera proposée dans une version ultérieure.

### Résolution des Incidents

**`Missing song book corpus` :** Le fichier `data/song-book/sdah.json` est absent. Restaurez-le via Git : `git checkout -- data/song-book/sdah.json` puis exécutez `npm run corpus:verify`.

**Accès bloqué :** Exécutez `npm run auth:set-password -- admin` pour redéfinir un mot de passe. Exécutez `npm run auth:unlock -- --list` pour lever les restrictions de connexion.

**Images non affichées :** Les images distantes doivent respecter les règles de sécurité d'adresses. L'import direct vers le serveur fonctionne toujours.

## Personnalisation

L'installation par défaut démarre avec un registre propre pour vos propres créations :

1. **Mises en page :** Connectez-vous en tant qu'administrateur et ouvrez `/admin/artifacts`. Les mises en page se conçoivent dans l'éditeur visuel ou s'importent depuis PowerPoint. 38 exemples peuvent être chargés via `npm run seed:demo`.
2. **Registre privé :** Si vous préférez isoler les données de votre paroisse hors de Git, déposez le fichier sous `data/local/default-registry.json`. Ce chemin est ignoré par Git. Voir [`.constitution/project/private-data.md`](.constitution/project/private-data.md).

## Corpus Intégrés

Deux corpus de textes vérifiés sont fournis par défaut :

| Fichier | Contenu | Au Démarrage |
| --- | --- | --- |
| `data/song-book/sdah.json` | 695 cantiques du Seventh-day Adventist Hymnal | titres et paroles chargés depuis le fichier |
| `data/en/bible-translation/kjv.json` | 66 livres, 1189 chapitres, 31102 versets KJV | synchronisés depuis le fichier local (~130 à 150 ms) |

Exécutez `npm run corpus:verify` pour valider l'intégrité des corpus.

Consultez [ATTRIBUTIONS.md](ATTRIBUTIONS.md) pour le détail des droits d'auteur et les demandes de retrait.

## Déploiement

Compilez l'API Go et le SPA, puis lancez `./api` (ou `npm start`) sur un serveur disposant de Node 22 dans le `PATH`. Consultez [`.constitution/project/deployment.md`](.constitution/project/deployment.md).

## Historique du Projet et Confidentialité

Ce projet a débuté sous la forme d'un dépôt privé pour une assemblée locale. L'historique public a été réinitialisé avec des données synthétiques d'exemple (*Harborlight Adventist Fellowship*) afin de protéger la vie privée des membres.

Les contributeurs doivent impérativement consulter [`.constitution/project/private-data.md`](.constitution/project/private-data.md) avant toute soumission.

## Licence et Marques

- **Licence du Code :** Distribué sous [Licence MIT](LICENSE).
- **Attributions et Recueils :** Recueils de cantiques, traductions bibliques et composants tiers sont détaillés dans [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
- **Polices Tierces :** Mentions de droits d'auteur et textes intégraux des licences SIL OFL 1.1 et Apache 2.0 pour les 35 familles de polices disponibles dans [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES).
- **Confidentialité et Sécurité :** 100% offline-first. Les données restent strictement sur votre machine; aucune télémétrie ni analyse (voir [PRIVACY.md](PRIVACY.md) et [SECURITY.md](SECURITY.md)).
- **Nom et Logo :** La licence MIT couvre le code source, mais ne confère aucun droit sur les marques. Les appellations **WorshipDeck** et **Wira Delta Indonesia** ainsi que le logo sont la propriété exclusive de PT Wira Delta Indonesia.
