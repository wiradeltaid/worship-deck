# 03: Inno Setup Installer Pipeline and Data Preservation

**What to build:**
Create the official Inno Setup installer script and packaging workflow:
1. Author `installer/worship-presenter.iss` compiling all necessary binaries and runtime assets into `WorshipPresenterSetup.exe`.
2. Configure `AppMutex=Global\WorshipPresenter.SingleInstance` to prevent installing updates while the application is running.
3. Install program binaries, Vite SPA build, bundled Node runtime, and default seed catalog into `{autopf}\Worship Presenter Web`.
4. Ensure the uninstaller explicitly protects `%LocalAppData%\WorshipPresenter` (SQLite DB, uploads, config) and only offers data deletion via an explicit optional checkbox.
5. Provide desktop and Start Menu shortcuts with proper icons and working directory flags.

**Blocked by:** 02-bundled-portable-node-and-pptx-worker-isolation.md

**Status:** closed

- [x] Author `installer/worship-presenter.iss` with proper app version, publisher metadata, and AppMutex.
- [x] Define files and directory mapping separating read-only application files from user data directories.
- [x] Implement `CloseApplications=yes` and mutex validation in Inno Setup.
- [x] Ensure uninstaller preserves `%LocalAppData%\WorshipPresenter` by default.
- [x] Add packaging build script in `package.json` (`npm run package:installer`).
- [x] Human verification check: Install the application via generated setup, create a local service with custom hymns, run installer update to a newer build, and verify that the created service and database remain 100% intact.
