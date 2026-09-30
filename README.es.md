# WorshipDeck

> Suite local-first de presentación y gestión litúrgica para iglesias que convierte el programa de culto en diapositivas listas para proyectar: genera presentaciones PowerPoint (.pptx) con fuentes incrustadas para uso sin conexión, consola de operador para la pantalla de la congregación y control remoto para smartphones mediante Wi-Fi local.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.com/worship-deck) | [Descargar v0.1.0](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe) | [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [Todos los lanzamientos](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

Diseñado para congregaciones cristianas e iglesias litúrgicas. Los diseños de diapositiva se gestionan como datos configurables y no como código estático, lo que permite adaptarlo directamente desde el navegador.

## Problema que Resuelve

Preparar manualmente las diapositivas de cada culto requiere horas semanales, gran parte de las cuales se pierden en volver a escribir letras de himnos ya digitalizadas. Un cambio imprevisto obliga a rehacer la presentación desde cero.

WorshipDeck toma el guión del culto y estructura automáticamente diapositivas limpias y consistentes:

```text
texto del programa  ->  análisis del culto  ->  plan de diapositivas  ->  +->  PowerPoint (.pptx) sin conexión
                                                                          +->  consola de operador + pantalla de congregación
```

Las letras de los himnos se consultan por número en la base de datos local. Los diseños se editan en el navegador mediante un registro SQLite. La proyección no requiere conexión a Internet una vez descargado el archivo.

## Instalación

### Servidor Local Autónomo (Recomendado)

Ejecutar WorshipDeck como servidor local autónomo es el modelo de despliegue principal y recomendado:

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck && npm install && npm run setup && npm run dev
```

`npm run setup` genera el archivo `.env` con claves seguras e inicializa SQLite. `npm run dev` inicia la API en Go en `http://localhost:3000` y la SPA Vite en `http://localhost:5173`. Consulte [docs/deployment.md](docs/deployment.md) para despliegues de producción.

### Aplicación de Escritorio Windows (Experimental)

Descargue el instalador independiente para configuraciones de iglesia en un único equipo:

- **Descarga Directa:** [WorshipDeck-0.1.0-x64-setup.exe](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe)
- **Suma de Verificación:** [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [Todos los lanzamientos](https://github.com/wiradeltaid/worship-deck/releases)

> **Nota sobre Windows SmartScreen:** Dado que esta compilación no cuenta con firma EV comercial, Windows SmartScreen puede mostrar una advertencia. Haga clic en **Más información** (More info) y luego en **Ejecutar de todas formas** (Run anyway).

## Características Principales

- **Ingesta del programa:** Pegue texto plano en el formulario web; las líneas no reconocidas se muestran con total transparencia.
- **División automática de estrofas y coros:** Los himnos referenciados por número se desglosan en título, estrofas y coros repetitivos.
- **Diseños de diapositiva editables:** Administre diseños en SQLite con editor de lienzo en el navegador o importe desde PowerPoint.
- **Modo operador de dos pantallas:** Consola de operador, pantalla de congregación independiente, función de pantalla en negro (`B`) y control móvil.
- **Exportación PowerPoint 16:9:** Presentaciones `.pptx` independientes con fuentes incrustadas para uso completamente sin conexión.
- **Consulta bíblica inmediata:** Proyecte pasajes de la Biblia (KJV) durante el culto y retírelos al instante.
- **Tipografía sin conexión:** 41 familias tipográficas empaquetadas localmente y soporte para fuentes personalizadas.
- **Sincronización manual (experimental):** Transfiera datos entre dos instancias en la misma red local bajo demanda.

## Documentación

- **[Getting Started](docs/getting-started.md):** Guía de instalación en servidor y aplicación de escritorio.
- **[Features and Workflows](docs/features.md):** Manual completo de funciones y guía para operadores.
- **[Configuration and Administration](docs/configuration.md):** Configuración de campos dinámicos y base de datos.
- **[Customization and Slide Layouts](docs/customization.md):** Edición en lienzo, importación PPTX y datos de muestra.
- **[Shipped Corpora](docs/corpora.md):** Especificaciones de los corpus SDAH y KJV e himnarios adicionales.
- **[Production Deployment](docs/deployment.md):** Servicio permanente con systemd y proxy inverso.
- **[Project History](docs/history.md):** Origen del proyecto, linaje público y garantías de privacidad.

## Requisitos del Sistema

- **Servidor (Recomendado):** Linux (Ubuntu), Windows 10/11 o POSIX con Go 1.24+ y Node.js 22.12+. Basado en React 19 y SQLite embebido.
- **Escritorio Windows (Experimental):** Windows 10/11 de 64 bits.

## Licencia y Marcas

- **Licencia de Código:** Distribuido bajo la [Licencia MIT](LICENSE).
- **Atribuciones:** Los avisos de derechos de autor de fuentes, himnos y textos bíblicos se detallan en [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
