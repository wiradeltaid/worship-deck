# WorshipDeck

> Suite local-first de presentación y gestión litúrgica para iglesias que convierte el programa de culto en diapositivas listas para proyectar: genera presentaciones PowerPoint (.pptx) sin conexión con fuentes incrustadas, consola de operador para proyector de dos pantallas y control remoto para smartphones mediante Wi-Fi local.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.id/worship-deck) | [Download for Windows](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

> **Aviso de traducción:** Este archivo es una traducción de [README.md](README.md) sólo para fines de conveniencia. En caso de discrepancia o conflicto de interpretación, la versión oficial en inglés (`README.md`) prevalece como autorizada. Toda la documentación técnica profunda y los documentos legales se mantienen en inglés.

Diseñado para congregaciones cristianas e iglesias litúrgicas. Las plantillas se gestionan como datos configurables y no como código estático, lo que permite a cualquier iglesia con un orden litúrgico similar adaptarlo directamente desde el navegador.

## Problema que Resuelve

Preparar manualmente las diapositivas de cada servicio lleva entre 2 y 4 horas semanales, gran parte de las cuales se desperdician en volver a escribir letras de himnos ya digitalizadas anteriormente. Un cambio imprevisto de canciones obliga a rehacer la presentación desde cero, y los conocimientos técnicos suelen depender de un único voluntario.

WorshipDeck toma el guión del culto preparado por los líderes (copiado en un formulario o enviado vía bot de mensajería) y estructura automáticamente diapositivas limpias y consistentes.

```text
texto del programa  →  análisis del culto  →  plan de diapositivas  →  ┬→  PowerPoint (.pptx) sin conexión
                                                                       ├→  presentación web a pantalla completa
                                                                       └→  consola de operador + proyector
```

Las letras de los himnos se consultan directamente por número en la base de datos local. Las plantillas visuales se editan en el navegador a través de un registro SQLite. Una vez descargado el archivo PowerPoint, la proyección no requiere conexión a Internet, lo que garantiza un culto sin interrupciones incluso ante fallas de red en el templo.

## Características Principales

- **Ingesta automática del programa de culto:** Pegue texto plano o envíelo vía webhook autenticado. Las líneas no reconocidas se muestran con total transparencia.
- **División automática de estrofas y coros:** Los himnos referenciados por número se desglosan en título, estrofas y coros repetitivos para facilitar el canto de la congregación.
- **Editor visual de plantillas (WYSIWYG):** 28 plantillas integradas con manipulación en lienzo: arrastre, redimensione, personalice tipografías y agregue elementos gráficos.
- **Un diseño para cuatro salidas (16:9 panorámico):** Una única estructura de datos alimenta presentaciones PPTX, visualización web, proyector de congregación y vista previa en vivo en proporción 1:1.
- **Modo operador de dos pantallas:** Vista de diapositiva actual y siguiente, tira de fotogramas en miniatura, lista de servicio y ventana independiente para arrastrar al proyector.
- **Función de pantalla en negro (Blank Screen):** Oculte instantáneamente la imagen del proyector y recupérela sin perder el punto de avance (`B`).
- **Transiciones configurables:** Corte, fundido, disolución y desplazamiento aplicados de forma idéntica en web y PowerPoint.
- **Consulta inmediata de pasajes bíblicos:** Proyecte lecturas bíblicas (KJV) durante la predicación y retírelas al instante.
- **Gestión de anuncios:** Administración de volantes y afiches desde almacenamiento local o URLs autorizadas.
- **Incrustación de fuentes personalizadas:** Incrustación ECMA-376 para renderizado fiel en cualquier equipo con Microsoft PowerPoint.
- **Cuentas y roles:** Separación entre administradores y operadores, limitación de intentos de acceso y sesiones revocables.

## Requisitos del Sistema

- **Aplicación de Escritorio:** Windows 10/11 de 64 bits.
- **Compilación desde el Código Fuente:** Go 1.24+ y Node.js 22+. Utiliza SQLite embebido sin necesidad de configurar servidores de bases de datos externos.

## Instalación

### Instalador de Escritorio para Windows (Recomendado)

Descargue `WorshipDeckSetup.exe` desde la [página oficial de lanzamientos](https://github.com/wiradeltaid/worship-deck/releases) y complete el asistente de instalación.

> **Nota sobre Windows SmartScreen:** Dado que esta compilación aún no cuenta con un certificado de firma de código EV comercial de alto costo, Windows SmartScreen puede mostrar una advertencia. Haga clic en **"Más información"** y luego en **"Ejecutar de todas formas"**.

### Ejecución desde el Código Fuente

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck
npm install
npm run setup
npm run dev
```

`npm run setup` genera el archivo `.env`, inicializa la base de datos SQLite, registra las plantillas por defecto e imprime la contraseña inicial del administrador.

---

## Licencia y Marca Registrada

- **Licencia de Código:** Distribuido bajo la [Licencia MIT](LICENSE).
- **Atribuciones y Contenidos:** Himnarios, versiones bíblicas y componentes de terceros están detallados en [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
- **Privacidad y Seguridad:** 100% local-first. Los datos de la congregación permanecen exclusivamente en su equipo; cero telemetría y cero analíticas (consulte [PRIVACY.md](PRIVACY.md) y [SECURITY.md](SECURITY.md)).
- **Nombre e Icono:** La licencia MIT concede derechos sobre el código fuente, no sobre los nombres ni logotipos. Los nombres **WorshipDeck** y **Wira Delta Indonesia**, así como el icono del producto, son propiedad exclusiva de PT Wira Delta Indonesia.
