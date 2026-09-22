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
- **Éditeur visuel de modèles (WYSIWYG) :** 28 modèles intégrés modifiables directement sur le canevas : repositionnement, redimensionnement et polices personnalisées.
- **Une disposition pour quatre affichages (16:9 large) :** Une structure de données unique alimente PowerPoint, affichage Web, projecteur et aperçu en direct à l'échelle 1:1.
- **Mode régie double écran :** Diapositives actuelle et suivante, pellicule miniature, déroulé du culte et fenêtre indépendante à glisser vers le projecteur.
- **Fonction écran noir (Blank Screen) :** Masquez instantanément l'affichage du projecteur sans perdre votre position de lecture (`B`).
- **Transitions au choix :** Coupure, fondu, dissolution et glissement appliqués à l'identique sur le Web et dans PowerPoint.
- **Affichage direct de passages bibliques :** Projetez des versets bibliques (KJV) pendant la prédication et masquez-les d'un clic.
- **Annonces paroissiales :** Gestion des affiches et avis paroissiaux depuis les fichiers locaux ou des adresses approuvées.
- **Intégration de polices personnalisées :** Intégration ECMA-376 assurant un rendu parfait sur n'importe quel ordinateur doté de Microsoft PowerPoint.
- **Gestion des accès :** Séparation des comptes administrateur et opérateur, limitation du débit de connexion contre les attaques par force brute.

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

`npm run setup` génère le fichier `.env`, initialise la base de données SQLite et crée le mot de passe administrateur par défaut.

---

## Licence et Droit des Marques

- **Licence du Code :** Distribué sous [Licence MIT](LICENSE).
- **Recueils de Cantiques & Attributions :** Les recueils de chants, traductions bibliques et attributions tierces sont détaillés dans [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
- **Confidentialité & Sécurité :** 100% local-first. Les données de l'assemblée restent exclusivement sur votre machine locale ; zéro télémétrie (voir [PRIVACY.md](PRIVACY.md) et [SECURITY.md](SECURITY.md)).
- **Nom et Marque :** La licence MIT accorde des droits sur le code source, mais n'accorde aucun droit sur les noms ou logos. Les noms **WorshipDeck** et **Wira Delta Indonesia**, ainsi que l'icône du produit, restent la propriété exclusive de PT Wira Delta Indonesia.
