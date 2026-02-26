# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HVAC Airflow & Sound Simulator — a pure client-side web application for HVAC engineers to place air outlets in a 3D room, simulate jet physics (VDI 3803/ASHRAE), visualize airflow particles and sound heatmaps, and export PDF reports. No server, no build tools, no frameworks — open `index.html` in a browser and it works.

## Running the Application

This is a static site using ES6 module imports. It requires a local HTTP server (due to import maps and fetch for locale JSON). Any static file server works:

```bash
# Python
python -m http.server 8080

# Node (npx, no install needed)
npx serve . -p 8080

# VS Code: use "Live Server" extension
```

Then open `http://localhost:8080`. There are no build steps, no bundler, no package.json.

**Browser requirement:** WebGL2 support (Chrome 60+, Firefox 78+, Edge 79+).

## Architecture

### Module Organization

All source code lives in `js/` as ES6 modules imported via `<script type="module">` in `index.html`:

- **`js/app.js`** — Central orchestrator. Wires all modules together, manages the global `state` object, handles all cross-module event coordination. This is the main entry point.
- **`js/scene/`** — Three.js 3D rendering layer (room geometry, outlet placement with drag/drop/snap, obstacle management, visualization with particles/heatmaps/cones)
- **`js/simulation/`** — Analytical calculation engine (jet physics, acoustics, thermal comfort). No CFD — uses VDI/ASHRAE formulas.
- **`js/ui/`** — DOM-based UI panels (sidebar outlet library, properties panel, toolbar, room creation modal, i18n, undo/redo)
- **`js/io/`** — Persistence (JSON project save/load with `.hvac` extension, PDF export with html2canvas screenshots)

### State Management

A single global `state` object in `app.js` holds all application state (room dimensions, outlets Map, obstacles Map, simulation results, UI flags). No state library — all UI updates are direct DOM manipulation after state changes.

### Key Technical Details

- **Three.js** is vendored locally in `lib/` (not CDN) for offline use, mapped via `<script type="importmap">` in index.html
- **i18n**: Custom lightweight system in `js/ui/i18n.js` using `data-i18n` DOM attributes and `t(key, params)` function. Translations in `assets/locales/{de,en}.json` (~120 keys each)
- **Undo/Redo**: Stack-based system in `js/ui/undoRedo.js` (max 50 entries) tracking outlet/obstacle add/remove/modify actions
- **Diffuser catalog**: `js/simulation/diffuserDB.js` contains all outlet types (swirl, slot, nozzle, plate valve, SCHAKO DQJ), room type noise limits, and surface absorption coefficients
- **PDF Export**: 6-page report generated client-side with jsPDF + html2canvas screenshots of 3D views
- **Autosave**: Projects stored in `localStorage` under key `hvac_simulator_autosave`

### Simulation Standards

The physics engine implements:
- **Jet throw**: VDI 3803 / ASHRAE Fundamentals Ch.20 (free jet, wall jet with Coanda effect, swirl diffusers)
- **Acoustics**: Sound power propagation with room absorption (equivalent absorption area), inverse square law
- **Comfort**: Fanger PMV/PPD model, draft risk per EN 16798, radiant asymmetry

## Conventions

- **Language**: UI is bilingual DE/EN; code comments and commit messages in English+German
- **File naming**: `camelCase.js` for modules
- **Function naming**: `camelCase()` for functions, `UPPER_CASE` for constants
- **CSS classes**: `kebab-case` (e.g. `.props-section`, `.toolbar-btn`)
- **i18n keys**: `section.key.subkey` format (e.g. `props.outlet.volumeFlow`)
- **CSS**: Single monolithic `style.css` using CSS custom properties for theming
- **Layout**: CSS Grid (header, sidebar, viewport, properties, toolbar, status)
- **Units**: Metric (meters, m/s, Pa, dB(A), m³/h)
