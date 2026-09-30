# WorshipDeck

> Локальный программный комплекс для церковных богослужений и презентаций (local-first): автоматическое преобразование расписания службы в готовые слайды: генерация автономных презентаций PowerPoint (.pptx) со встроенными шрифтами, двухэкранная консоль оператора для экрана общины и дистанционное управление со смартфона по локальному Wi-Fi.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.com/worship-deck) | [Скачать v0.1.0](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe) | [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [Все релизы](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

Разработано для христианских общин и литургических богослужений. Макеты слайдов хранятся как настраиваемые данные, а не жестко закодированы, что позволяет адаптировать их прямо в браузере.

## Решаемые задачи

Ручная подготовка слайдов к богослужению отнимает часы каждую неделю, большая часть которых тратится на повторный набор текстов гимнов. Неожиданная замена псалма вынуждает переделывать презентацию заново.

WorshipDeck принимает расписание службы и автоматически формирует аккуратные слайды:

```text
текст расписания  ->  анализ службы  ->  план слайдов  ->  +->  автономный PowerPoint (.pptx)
                                                           +->  консоль оператора + экран общины
```

Тексты гимнов загружаются по номеру из локальной базы данных. Макеты настраиваются в браузере через SQLite. После скачивания файла подключение к сети не требуется.

## Установка

### Локальный сервер (Рекомендуется)

Запуск WorshipDeck в качестве локального сервера является основной и рекомендуемой моделью развертывания:

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck && npm install && npm run setup && npm run dev
```

`npm run setup` создает файл `.env` со сгенерированными ключами и инициализирует SQLite. `npm run dev` запускает Go API на `http://localhost:3000` и Vite SPA на `http://localhost:5173`. Руководство по развертыванию доступно в [docs/deployment.md](docs/deployment.md).

### Десктопное приложение Windows (Экспериментально)

Загрузите автономный установщик для запуска на одном церковном компьютере:

- **Прямая загрузка:** [WorshipDeck-0.1.0-x64-setup.exe](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe)
- **Контрольная сумма:** [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [Все релизы](https://github.com/wiradeltaid/worship-deck/releases)

> **Примечание Windows SmartScreen:** Поскольку данная сборка еще не подписана коммерческим EV-сертификатом, Windows SmartScreen может отобразить предупреждение. Нажмите **Подробнее** (More info), затем **Выполнить в любом случае** (Run anyway).

## Основные возможности

- **Автоматический разбор расписания:** Вставка текста в веб-форму; нераспознанные строки отображаются прозрачно.
- **Разделение на куплеты и повтор припева:** Гимны разделяются на заглавный слайд, куплеты и припевы.
- **Редактируемые макеты слайдов:** Управление макетами в SQLite в браузере или импорт из PowerPoint.
- **Двухэкранный режим:** Консоль оператора, независимое окно экрана общины, затемнение (`B`) и мобильный пульт.
- **Экспорт в PowerPoint 16:9:** Файлы `.pptx` со встроенными шрифтами для показа без интернета.
- **Вывод библейских стихов:** Быстрый показ стихов Библии (KJV) на экране общины во время проповеди.
- **Шрифты без подключения к сети:** 41 встроенное семейство шрифтов и поддержка добавления пользовательских.
- **Ручная синхронизация (экспериментально):** Передача данных между двумя экземплярами в локальной сети по запросу.

## Документация

- **[Getting Started](docs/getting-started.md):** Настройка сервера и установка десктопной версии.
- **[Features and Workflows](docs/features.md):** Обзор всех функций и руководство оператора.
- **[Configuration and Administration](docs/configuration.md):** Настройка полей формы и управление базой данных.
- **[Customization and Slide Layouts](docs/customization.md):** Редактирование макетов, импорт PPTX и демо-данные.
- **[Shipped Corpora](docs/corpora.md):** Корпуса SDAH и KJV и добавление собственных сборников.
- **[Production Deployment](docs/deployment.md):** Запуск через systemd и настройка прокси.
- **[Project History](docs/history.md):** История проекта, границы открытого кода и защита данных.

## Системные требования

- **Серверная установка (Рекомендуется):** Linux (Ubuntu), Windows 10/11 или POSIX с Go 1.24+ и Node.js 22.12+. React 19 и SQLite.
- **Десктопное приложение Windows (Экспериментально):** Windows 10/11 64-бит.

## Лицензия и торговые марки

- **Лицензия на код:** Распространяется под [Лицензией MIT](LICENSE).
- **Авторские права:** Сведения о правах на шрифты, гимны и библейские тексты изложены в [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
