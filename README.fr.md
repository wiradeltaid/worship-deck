# WorshipDeck

> Suite locale de présentation et de régie de culte (local-first) qui transforme le déroulement du service en diapositives prêtes à l'emploi: génère des diaporamas PowerPoint (.pptx) avec polices intégrées pour une utilisation hors ligne, une console pupitre double écran pour l'écran de l'assemblée et une télécommande pour smartphone via Wi-Fi local.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.com/worship-deck) | [Télécharger v0.1.0](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe) | [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [Toutes les versions](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

Conçu pour les assemblées chrétiennes et les cultes liturgiques. Les mises en page de diapositives sont gérées comme des données configurables plutôt que du code figé, permettant de les adapter directement depuis son navigateur.

## Problématique Résolue

Préparer manuellement les diapositives de culte prend des heures, principalement consacrées à ressaisir des paroles de cantiques déjà enregistrées. Un changement imprévu contraint à refaire le diaporama.

WorshipDeck lit le déroulement préparé et génère automatiquement des diapositives impeccablement structurées:

```text
texte du programme  ->  analyse du culte  ->  plan de diapositives  ->  +->  PowerPoint hors ligne (.pptx)
                                                                        +->  console pupitre + écran de l'assemblée
```

Les paroles des cantiques sont indexées par numéro depuis la base de données locale. Les mises en page s'éditent directement dans le navigateur via SQLite. Aucune connexion Internet n'est requise après téléchargement.

## Guide d'Installation

### Serveur Local Autonome (Recommandé)

L'exécution en tant que serveur local autonome constitue le modèle de déploiement principal et recommandé:

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck && npm install && npm run setup && npm run dev
```

`npm run setup` génère le fichier `.env` avec des clés sécurisées et initialise SQLite. `npm run dev` lance l'API Go sur `http://localhost:3000` et la SPA Vite sur `http://localhost:5173`. Consultez [docs/deployment.md](docs/deployment.md) pour la production.

### Application de Bureau Windows (Expérimental)

Téléchargez l'assistant d'installation autonome pour les postes paroissiaux uniques:

- **Téléchargement Direct:** [WorshipDeck-0.1.0-x64-setup.exe](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe)
- **Somme de Contrôle:** [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [Toutes les versions](https://github.com/wiradeltaid/worship-deck/releases)

> **Note sur Windows SmartScreen:** Cette version n'étant pas encore signée par un certificat EV commercial, Windows SmartScreen peut afficher un avertissement. Cliquez sur **Informations complémentaires** (More info), puis sur **Exécuter quand même** (Run anyway).

## Fonctionnalités Principales

- **Import automatique du programme:** Collez le texte brut dans le formulaire Web; les lignes non reconnues restent visibles.
- **Découpage des strophes et refrains:** Les cantiques référencés par numéro sont scindés en titre, strophes et refrains.
- **Mises en page modifiables:** Gérez les mises en page dans SQLite via un éditeur sur canevas ou importez depuis PowerPoint.
- **Mode régie double écran:** Console pupitre, écran de l'assemblée indépendant, fonction écran noir (`B`) et télécommande smartphone.
- **Export PowerPoint 16:9:** Diaporamas `.pptx` autonomes avec polices intégrées pour une utilisation hors ligne.
- **Affichage direct de passages bibliques:** Projetez des versets bibliques (KJV) pendant le culte et masquez-les d'un clic.
- **Typographie hors ligne:** 41 familles de polices intégrées et prise en charge de polices personnalisées.
- **Synchronisation manuelle (expérimental):** Transférez des données entre deux instances sur le réseau local à la demande.

## Documentation

- **[Getting Started](docs/getting-started.md):** Guide de déploiement serveur et installation bureau.
- **[Features and Workflows](docs/features.md):** Présentation complète des fonctions et guide d'utilisation.
- **[Configuration and Administration](docs/configuration.md):** Configuration des formulaires et gestion de la base.
- **[Customization and Slide Layouts](docs/customization.md):** Éditeur sur canevas, import PowerPoint et données d'exemple.
- **[Shipped Corpora](docs/corpora.md):** Spécifications des corpus SDAH et KJV et recueils supplémentaires.
- **[Production Deployment](docs/deployment.md):** Service permanent systemd et proxy inverse.
- **[Project History](docs/history.md):** Historique du projet, garanties de confidentialité et code source.

## Prérequis Système

- **Serveur (Recommandé):** Linux (Ubuntu), Windows 10/11 ou POSIX avec Go 1.24+ et Node.js 22.12+. React 19 et SQLite intégré.
- **Application Bureau Windows (Expérimental):** Windows 10/11 64 bits.

## Licence et Marques

- **Licence du Code:** Distribué sous [Licence MIT](LICENSE).
- **Attributions:** Les droits des polices tierces, cantiques et textes bibliques sont détaillés dans [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
