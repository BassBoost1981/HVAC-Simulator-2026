# Product Requirements Document (PRD)
# HVAC Airflow & Sound Simulator — Web-First Edition

**Version:** 1.0  
**Datum:** 23. Februar 2026  
**Status:** Planning Phase  
**Ansatz:** Web-First, inkrementell, sofort lauffähig  
**Sprache:** Deutsch (Entwicklungsdokumentation) / UI zweisprachig DE+EN

---

## 1. Executive Summary

### 1.1 Projektziel

Entwicklung eines lokalen HVAC-Simulators für Luftauslässe — leichtgewichtig, sofort nutzbar, inkrementell erweiterbar. Der Fokus liegt auf einem schlanken Web-First-Ansatz, der in Schichten aufgebaut wird und nach jeder Phase sofort funktioniert.

### 1.2 Kernidee

Eine **reine Web-Anwendung** (HTML + JavaScript + Three.js), die lokal im Browser läuft. Kein Server, kein Build-Tool, kein Framework nötig. Alles in einem Ordner, öffne `index.html` → fertig.

Die Simulation basiert auf **analytischen Strahlformeln** (VDI/ASHRAE), nicht auf CFD. Das ist exakt derselbe Ansatz, den Lindab ICD, Trox EasySelect und Swegon ProSelect verwenden. Für 90% der Planungsaufgaben ist das ausreichend.

### 1.3 Was es kann (Endzustand Phase 4)

1. Einen Raum in 3D definieren (Maße eingeben oder Grundriss zeichnen)
2. Luftauslässe per Drag & Drop platzieren (Decke, Wand, Boden)
3. Parameter pro Auslass einstellen (Volumenstrom, Temperatur, Typ)
4. Sofortige Strahlberechnung sehen (Wurfweite, Geschwindigkeitsabfall, Coanda)
5. Partikelvisualisierung der Luftströmung in Echtzeit
6. Schalldruckpegel-Heatmap auf Arbeitshöhe
7. Komfortbewertung nach DIN 1946 / EN 16798
8. Projekt speichern/laden als JSON
9. PDF-Bericht exportieren

### 1.4 Was es bewusst NICHT kann

- Keine echte CFD-Simulation (kein OpenFOAM, kein Mesh)
- Keine Strömungsinterferenz zwischen Auslässen (erst in späteren Phasen vereinfacht)
- Kein IFC/BIM-Import (nur manuelle Raumdefinition)
- Keine Mehrraum-Projekte
- Keine Cloud, keine Accounts, keine Datenbank

### 1.5 Erfolgskriterium

Ein HVAC-Ingenieur kann in **unter 3 Minuten** einen Raum erstellen, 1–4 Auslässe platzieren, die Strömung visualisieren und einen PDF-Bericht exportieren — alles im Browser, offline, ohne Installation.

---

## 2. Zielgruppe & Nutzungskontext

### 2.1 Primäre Nutzer

| Rolle | Bedarf | Wie sie heute arbeiten |
|-------|--------|----------------------|
| HVAC-Planer (TGA-Büro) | Schnelle Vorauslegung, Variantenvergleich | Excel + VDI-Tabellen + Herstellertools |
| Lüftungstechniker | Überprüfung von Wurfweiten bei Montage | Herstellerkataloge, Daumenregeln |
| Bauphysiker/Akustiker | Schallprognose bei Auslasswahl | DIN-Tabellen, manuelle Berechnung |
| Vertriebsingenieur | Kundenpräsentation mit Visualisierung | PowerPoint mit statischen Bildern |

### 2.2 Typisches Szenario

> Ein Planer sitzt beim Kunden. Es geht um einen Besprechungsraum 8×6×3m. Der Kunde fragt: "Welche Auslässe sollen wir nehmen? Wird es zugig? Wie laut wird es?" Der Planer öffnet das Tool im Browser, tippt die Raummaße ein, zieht zwei Drallauslässe auf die Decke, stellt 250 m³/h pro Stück ein — und zeigt dem Kunden live die Partikelanimation und die Schallkarte. Nach 2 Minuten exportiert er ein PDF.

### 2.3 Technische Voraussetzungen

- **Browser:** Chrome 90+, Firefox 90+, Edge 90+ (WebGL 2.0 Unterstützung)
- **Hardware:** Jeder PC/Laptop der letzten 8 Jahre mit integrierter GPU
- **Netzwerk:** Nicht nötig (100% offline nach einmaligem Download)
- **Betriebssystem:** Egal (Windows, macOS, Linux)
- **Installation:** Keine — Ordner entpacken, `index.html` öffnen

---

## 3. Technologie-Stack

### 3.1 Übersicht

```
┌─────────────────────────────────────────────────────┐
│                  Browser (Chrome/Firefox/Edge)        │
├─────────────────────────────────────────────────────┤
│  UI Layer                   │  3D Layer              │
│  ┌───────────────────────┐  │  ┌──────────────────┐  │
│  │ Vanilla HTML/CSS       │  │  │ Three.js r160+   │  │
│  │ - Sidebar (Bibliothek)│  │  │ - Scene/Camera   │  │
│  │ - Properties Panel    │  │  │ - OrbitControls  │  │
│  │ - Toolbar             │  │  │ - Raycasting     │  │
│  │ - Status Bar          │  │  │ - Partikel-GPU   │  │
│  └───────────────────────┘  │  └──────────────────┘  │
│                              │                        │
│  Simulation Layer                                    │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Berechnungsmodule (ES6-Module, reines JS)       │ │
│  │  ├── jetPhysics.js     (Strahltheorie)          │ │
│  │  ├── acoustics.js      (Schallausbreitung)      │ │
│  │  ├── comfort.js        (Komfortbewertung)       │ │
│  │  └── diffuserModels.js (Auslass-Datenbank)      │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  Persistenz Layer                                    │
│  ┌─────────────────────────────────────────────────┐ │
│  │ projectFile.js  → JSON save/load (.hvac)        │ │
│  │ pdfExport.js    → jsPDF + html2canvas           │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 3.2 Warum diese Technologien

| Entscheidung | Begründung |
|-------------|-----------|
| **Kein Tauri/Electron** | Eliminiert Rust, IPC-Bugs, Build-Komplexität. Browser reicht. |
| **Kein Bundler nötig** | ES6 `import/export` funktioniert nativ in modernen Browsern. Vite optional für Dev-Komfort. |
| **Kein React/Vue** | Vanilla JS + DOM reicht für diese UI. Kein Framework-Overhead, kein State-Management-Chaos. |
| **Three.js** | Alternativlos für performante 3D-Darstellung im Browser. |
| **Kein OpenFOAM** | Analytische Formeln reichen für Auslassplanung. CFD löst ein anderes Problem (Raumströmung). |
| **jsPDF** | Client-seitige PDF-Erzeugung, kein Server nötig. |

### 3.3 Externe Bibliotheken (alle CDN oder lokal gebündelt)

| Bibliothek | Version | Zweck | Größe |
|-----------|---------|-------|-------|
| Three.js | r160+ | 3D-Rendering | ~600 KB |
| three/OrbitControls | r160+ | Kamerasteuerung | inkl. |
| three/DragControls | r160+ | Outlet-Verschiebung | inkl. |
| jsPDF | 2.5+ | PDF-Erzeugung | ~300 KB |
| html2canvas | 1.4+ | Screenshot für PDF | ~200 KB |
| i18next | 23+ | Mehrsprachigkeit | ~40 KB |

**Gesamtgröße der Anwendung: ~5–10 MB** (inkl. 3D-Modelle und Assets)

### 3.4 Ordnerstruktur

```
hvac-simulator/
├── index.html                 # Hauptdatei — hier starten
├── style.css                  # Gesamtes Styling
│
├── js/
│   ├── app.js                 # Einstiegspunkt, Event-Wiring
│   ├── scene/
│   │   ├── sceneManager.js    # Three.js Scene Setup
│   │   ├── roomBuilder.js     # 3D-Raum erzeugen
│   │   ├── outletPlacer.js    # Drag & Drop, Snapping
│   │   └── visualization.js   # Partikel, Heatmap, Zonen
│   ├── simulation/
│   │   ├── jetPhysics.js      # Freistrahl, Wandstrahl, Drall
│   │   ├── acoustics.js       # Schallausbreitung
│   │   ├── comfort.js         # PMV/PPD, Zugluft
│   │   └── diffuserDB.js      # Auslass-Katalog-Daten
│   ├── ui/
│   │   ├── sidebar.js         # Auslass-Bibliothek
│   │   ├── properties.js      # Parameter-Panel
│   │   ├── toolbar.js         # Werkzeugleiste
│   │   └── i18n.js            # Sprachumschaltung
│   └── io/
│       ├── projectFile.js     # JSON Save/Load
│       └── pdfExport.js       # PDF-Erzeugung
│
├── assets/
│   ├── models/                # GLB/GLTF 3D-Modelle der Auslässe
│   │   ├── drallauslass.glb
│   │   ├── tellerventil.glb
│   │   ├── schlitzauslass.glb
│   │   └── duesenauslass.glb
│   └── locales/
│       ├── de.json            # Deutsche Strings
│       └── en.json            # Englische Strings
│
├── lib/                       # Vendor-Bibliotheken (lokal für Offline)
│   ├── three.module.min.js
│   ├── OrbitControls.js
│   ├── jspdf.min.js
│   └── html2canvas.min.js
│
├── docs/
│   ├── PRD.md                 # Dieses Dokument
│   └── PHYSICS.md             # Formeldokumentation
│
└── examples/
    ├── buero-6x8.hvac         # Beispielprojekt
    └── besprechung-4x5.hvac   # Beispielprojekt
```

---

## 4. Physik-Engine: Berechnungsmodelle

Dies ist das Herzstück der Anwendung. Alle Formeln sind semi-empirisch und basieren auf Normen und Herstellerdaten. Sie liefern Ergebnisse in <1 ms.

### 4.1 Freistrahl-Grundlagen

Ein Luftauslass erzeugt einen Strahl, der sich kegelförmig ausbreitet. Die Geschwindigkeit nimmt mit der Entfernung ab, weil Raumluft induziert (mitgerissen) wird.

**Kernformel — Geschwindigkeitsabfall im Freistrahl (runder Querschnitt):**

```
v(x) = K₁ · v₀ · (d₀ / x)     für x > x_kern

Wobei:
  v(x)   = Geschwindigkeit in Entfernung x [m/s]
  K₁     = Auslasskonstante (typ. 1.0–1.4, herstellerabhängig)
  v₀     = Austrittsgeschwindigkeit [m/s]
  d₀     = effektiver Durchmesser [m]
  x      = Entfernung vom Auslass [m]
  x_kern = Kernlänge ≈ 5·d₀ (Bereich konstanter Geschwindigkeit)
```

**Austrittsgeschwindigkeit:**

```
v₀ = V̇ / A_eff

Wobei:
  V̇     = Volumenstrom [m³/s]  (Eingabe in m³/h, Umrechnung: /3600)
  A_eff  = Effektive Ausströmfläche [m²] (≠ Nennfläche, aus Herstellerdaten)
```

**Wurfweite (Entfernung bis Terminalgeschwindigkeit):**

```
x_T = K₁ · v₀ · d₀ / v_T

Wobei:
  x_T    = Wurfweite [m]
  v_T    = Terminalgeschwindigkeit [m/s]
           0.50 m/s → x₀.₅ (ASHRAE-Konvention)
           0.25 m/s → x₀.₂₅ (europäische Konvention, EN 12238)
           0.20 m/s → Aufenthaltszonengrenze (DIN 1946)
```

### 4.2 Coanda-Effekt (Deckenstrahl)

Wenn ein Auslass an der Decke montiert ist, "klebt" der Strahl an der Decke. Dies verlängert die Wurfweite und verhindert das Absinken kalter Luft.

```
x_coanda = √2 · x_freistrahl ≈ 1.41 · x_freistrahl

Bedingung: v ≥ 0.35 m/s für stabilen Coanda-Effekt
```

**Ablösepunkt (thermisch):**

Bei Kühlbetrieb (Zuluft kälter als Raumluft) löst sich der Strahl irgendwann von der Decke. Die Ablöseposition hängt von der Archimedes-Zahl ab:

```
Ar = g · ΔT · d₀ / (T_raum · v₀²)

Wobei:
  Ar     = Archimedes-Zahl [-]
  g      = 9.81 m/s²
  ΔT     = |T_raum - T_zuluft| [K]
  T_raum = Raumtemperatur [K] (= °C + 273.15)

Abschätzung Ablösepunkt:
  x_ablöse ≈ 0.5 · x_coanda / √Ar   (für Ar > 0.01)
```

### 4.3 Auslasstyp-spezifische Modelle

#### 4.3.1 Drallauslass (Swirl Diffuser)

Erzeugt einen radial-konischen Strahl mit Drallkomponente. Hohe Induktion, kurze Wurfweite, schnelle Geschwindigkeitsabnahme.

```
Strahltyp:     Radial, kegelförmig, mit Drall
K₁:            0.9–1.1
Strahlwinkel:  40–60° (halber Öffnungswinkel)
Induktion:     η = 8–15 (hoch)
Coanda:        Ja, an Decke
Spezialformel:

  v(r,z) = v₀ · (d₀/r) · K_drall · exp(-z²/(2·σ²))

  Wobei:
    r     = radiale Entfernung [m]
    z     = Abstand unter Decke [m]
    σ     = Strahldicke ≈ 0.1·r [m]
    K_drall = 0.8–1.0 (Drallverlust)
```

**Verfügbare Größen und typische Daten:**

| Nenngröße | d₀ [mm] | A_eff [m²] | V̇_nenn [m³/h] | Lw_A [dB(A)] |
|-----------|---------|-----------|---------------|-------------|
| DN 200    | 200     | 0.016     | 100–200       | 25–35       |
| DN 315    | 315     | 0.040     | 200–500       | 30–40       |
| DN 400    | 400     | 0.064     | 300–800       | 33–45       |
| DN 500    | 500     | 0.100     | 500–1200      | 36–48       |
| DN 625    | 625     | 0.156     | 800–2000      | 40–52       |

#### 4.3.2 Tellerventil (Plate Valve / Disc Valve)

Einfacher, günstiger Auslass. Erzeugt einen halbkugelförmigen Strahl. Für Abluft und kleine Zuluft.

```
Strahltyp:     Radial, halbkugelförmig
K₁:            0.7–0.9
Strahlwinkel:  70–90° (weit gespreizt)
Induktion:     η = 6–10
Coanda:        Gering (zu weit gespreizt)
```

| Nenngröße | d₀ [mm] | A_eff [m²] | V̇_nenn [m³/h] | Lw_A [dB(A)] |
|-----------|---------|-----------|---------------|-------------|
| DN 125    | 125     | 0.008     | 30–80         | 15–25       |
| DN 160    | 160     | 0.013     | 50–150        | 20–30       |
| DN 200    | 200     | 0.020     | 80–250        | 25–35       |
| DN 250    | 250     | 0.031     | 120–400       | 28–38       |

#### 4.3.3 Schlitzauslass (Slot Diffuser)

Langer, schmaler Auslass. Erzeugt einen ebenen (2D) Strahl. Für Fassaden und lange Räume.

```
Strahltyp:     Eben (2D), Schlitzstrahl
K₁:            1.0–1.4
Strahlwinkel:  15–25° (in Breitenrichtung)
Induktion:     η = 3–6
Coanda:        Stark (idealer Deckenstrahl)
Spezialformel:

  v(x) = K₁ · v₀ · √(s / x)

  Wobei:
    s     = Schlitzbreite [m] (typ. 15–25 mm)
    x     = Entfernung [m]
  
  (Achtung: √ statt linear, weil ebener Strahl langsamer abnimmt!)
```

| Typ | Schlitze | Breite [mm] | Länge [mm] | V̇_nenn [m³/h] | Lw_A [dB(A)] |
|-----|---------|------------|-----------|---------------|-------------|
| 1-Schlitz | 1 | 15 | 500–2000 | 50–200 | 20–30 |
| 2-Schlitz | 2 | 2×15 | 500–2000 | 100–400 | 25–35 |
| 4-Schlitz | 4 | 4×15 | 500–2000 | 200–800 | 30–40 |

#### 4.3.4 Düsenauslass (Nozzle Diffuser)

Gerichteter Strahl mit langer Wurfweite. Für hohe Räume und Industriehallen.

```
Strahltyp:     Rund, kompakt, gerichtet
K₁:            1.2–1.5
Strahlwinkel:  8–15° (eng gebündelt)
Induktion:     η = 2–4 (gering)
Coanda:        Nein (Freistrahl)
Wurfweite:     Sehr hoch (10–50 m möglich)
```

| Nenngröße | d₀ [mm] | V̇_nenn [m³/h] | Lw_A [dB(A)] |
|-----------|---------|---------------|-------------|
| DN 50     | 50      | 20–100        | 20–35       |
| DN 75     | 75      | 50–200        | 25–40       |
| DN 100    | 100     | 100–500       | 30–45       |
| DN 150    | 150     | 200–1000      | 35–50       |

### 4.4 Schallberechnung

#### 4.4.1 Schalldruckpegel in Entfernung r (Punktquellenmodell)

```
L_p(r) = L_W - 10·log10(Q / (4π·r²)) - D_raum

Vereinfacht für Deckenquelle (Halbraum, Q=2):
L_p(r) = L_W - 20·log10(r) - 8

Wobei:
  L_p    = Schalldruckpegel am Empfänger [dB(A)]
  L_W    = Schallleistungspegel des Auslasses [dB(A)]
  r      = Entfernung Auslass → Messpunkt [m]
  Q      = Richtwirkungsfaktor (1=frei, 2=Halbkugel/Decke, 4=Kante, 8=Ecke)
  D_raum = Raumdämpfungsterm [dB]
```

#### 4.4.2 Raumkorrektur (Diffusfeldanteil)

```
L_p(r) = L_W + 10·log10(Q/(4π·r²) + 4/A_α)

Wobei:
  A_α = äquivalente Absorptionsfläche [m²]
  A_α = Σ(S_i · α_i) für alle Oberflächen
  
Typische Absorptionsgrade (mittlere Frequenz):
  Beton/Putz:           α = 0.02–0.04
  Gipskarton:           α = 0.05–0.10
  Akustikdecke:         α = 0.70–0.95
  Teppichboden:         α = 0.20–0.40
  Fenster:              α = 0.10–0.15
  Büromöbel (pauschal):  +0.5 m² pro Arbeitsplatz
```

#### 4.4.3 Summenpegel mehrerer Quellen

```
L_gesamt = 10·log10(Σ 10^(L_i/10))

Sonderfall gleiche Pegel:
  2 gleiche Quellen: +3 dB
  3 gleiche Quellen: +4.8 dB
  4 gleiche Quellen: +6 dB
```

#### 4.4.4 Schallleistungspegel des Auslasses (volumenstrombhängig)

```
L_W(V̇) = L_W_ref + 50·log10(V̇ / V̇_ref)

(Näherung: +15 dB pro Verdopplung des Volumenstroms)
```

### 4.5 Komfortbewertung

#### 4.5.1 Geschwindigkeit in der Aufenthaltszone

Die Aufenthaltszone ist definiert als:
- Höhe: 0.1 m bis 1.8 m über Boden
- Seitlicher Abstand von Wänden: 0.5 m
- Abstand von Auslässen: 1.0 m

Grenzwerte nach DIN 1946 / EN 16798:

| Kategorie | Max. Luftgeschwindigkeit | Temperaturbereich |
|-----------|------------------------|-------------------|
| I (hoch)  | 0.15 m/s               | 23.5–25.5 °C     |
| II (mittel)| 0.20 m/s              | 23.0–26.0 °C     |
| III (akzeptabel)| 0.25 m/s         | 22.0–27.0 °C     |

#### 4.5.2 Zugluftrate (Draught Rate, DR)

```
DR = (34 - T_lokal) · (v - 0.05)^0.62 · (0.37·v·Tu + 3.14)

Wobei:
  T_lokal = lokale Lufttemperatur [°C]
  v       = lokale Luftgeschwindigkeit [m/s]
  Tu      = Turbulenzgrad [%] (typ. 30–60% bei Mischluft)
  
Grenzwert: DR < 15% für Kategorie II
```

#### 4.5.3 Schallgrenzwerte nach Raumtyp

| Raumtyp | Max. dB(A) | NC-Kurve |
|---------|-----------|----------|
| Einzelbüro | 35 | NC 30 |
| Großraumbüro | 40 | NC 35 |
| Besprechungsraum | 30–35 | NC 25–30 |
| Krankenhauszimmer | 30 | NC 25 |
| Klassenzimmer | 35 | NC 30 |
| Restaurant | 45 | NC 40 |
| Hörsaal | 30 | NC 25 |

---

## 5. Features — Detaillierte Beschreibung

### 5.1 Raumdesigner (Phase 1)

**FR-001: Raum erstellen**

Der Nutzer gibt Länge, Breite und Höhe in Metern ein. Die 3D-Ansicht zeigt sofort einen halbtransparenten Quader mit Gitternetz.

- Eingabefelder: L × B × H in Metern (0.5 m – 50 m, Schrittweite 0.1 m)
- Validierung: Alle Werte > 0, maximale Fläche 500 m², max. Höhe 20 m
- 3D-Darstellung: Boden opak (grau), Wände halbtransparent, Decke Gitternetz
- Maßbeschriftungen an den Kanten
- Boden-Grid: 0.5 m Raster, dezent sichtbar

**FR-002: Kamerasteuerung**

- OrbitControls: Linke Maus = Drehen, Rechte Maus = Verschieben, Scroll = Zoom
- Preset-Ansichten: Perspektive, Draufsicht, Vorderansicht, Seitenansicht
- Home-Button: Zurück zur Standardansicht
- Zoom-Grenzen: Nicht kleiner als 0.5 m, nicht weiter als 100 m

**FR-003: Raumeigenschaften**

- Absorptionsgrad pro Fläche (Decke, Boden, 4 Wände) als Dropdown:
  - Beton/Putz (α = 0.03)
  - Gipskarton (α = 0.08)
  - Akustikdecke (α = 0.85)
  - Teppich (α = 0.30)
  - Fenster/Glas (α = 0.12)
  - Benutzerdefiniert (Freitexteingabe)
- Raumtemperatur [°C] (Standard: 22 °C)
- Raumtyp (Dropdown) → setzt Schallgrenzwert automatisch

### 5.2 Auslass-Bibliothek & Platzierung (Phase 1–2)

**FR-004: Bibliothek-Sidebar**

Linke Sidebar zeigt verfügbare Auslasstypen als Kacheln mit Icon und Name:
- Drallauslass (4 Größen: DN 200/315/400/625)
- Tellerventil (4 Größen: DN 125/160/200/250)
- Schlitzauslass (3 Typen: 1/2/4-Schlitz)
- Düsenauslass (4 Größen: DN 50/75/100/150)

Jede Kachel zeigt: Icon, Name, Größenbereich, typischer V̇-Bereich.

**FR-005: Drag & Drop Platzierung**

1. Nutzer klickt auf Kachel → Auslass hängt am Cursor
2. Hover über den Raum → Auslass snappt auf nächste Fläche (Decke/Wand/Boden)
3. Visuelles Feedback: Grüner Indikator = gültige Position, Rot = ungültig
4. Klick → Auslass wird platziert
5. Properties-Panel öffnet sich automatisch

**FR-006: Snap-to-Grid**

- Raster: 0.25 m (einstellbar 0.1 / 0.25 / 0.5 / 1.0 m)
- Snap auf Flächen: Decke, Wand, Boden (automatische Erkennung per Raycasting)
- Snap deaktivierbar per Shift-Taste

**FR-007: Auslass verschieben/rotieren**

- Klick auf platzierten Auslass → Ausgewählt (Highlight + Gizmo)
- Drag → Verschieben auf der Fläche
- R-Taste → Rotation (15° Schritte, frei mit Shift)
- Delete-Taste → Auslass entfernen (mit Bestätigung)
- Doppelklick → Properties-Panel öffnen

### 5.3 Parameter-Panel (Phase 1–2)

**FR-008: Konfiguration pro Auslass**

Rechtes Panel, sichtbar wenn ein Auslass ausgewählt ist:

| Parameter | Einheit | Bereich | Standard |
|-----------|---------|---------|----------|
| Typ | - | Dropdown | (vom Drag) |
| Größe | mm | Dropdown je Typ | DN 315 |
| Volumenstrom | m³/h | 10–5000 | 250 |
| Zulufttemperatur | °C | 10–40 | 18 |
| Raumtemperatur | °C | 18–30 | 22 |
| Einbaulage | - | Decke/Wand/Boden | Decke |
| Rotation | ° | 0–360 | 0 |
| Position X | m | 0–L | (Platzierung) |
| Position Y | m | 0–B | (Platzierung) |

**Berechnete Ergebnisse (live, bei jeder Änderung):**

| Ergebnis | Einheit | Anzeige |
|----------|---------|---------|
| Austrittsgeschwindigkeit | m/s | Zahl + Balken |
| Wurfweite x₀.₂ | m | Zahl + Pfeil in 3D |
| Druckverlust | Pa | Zahl |
| Schallleistung L_W | dB(A) | Zahl + Ampel |
| Max. v in Aufenthaltszone | m/s | Zahl + Ampel (grün/gelb/rot) |
| Schallpegel bei 3m | dB(A) | Zahl + Ampel |

### 5.4 Visualisierung (Phase 2–3)

**FR-009: Partikel-Animation**

- GPU-basiertes Partikelsystem (Three.js Points + ShaderMaterial)
- 500–2000 Partikel pro Auslass (einstellbar)
- Partikel folgen dem berechneten Geschwindigkeitsfeld
- Farbcodierung:

```
v > 1.0 m/s    → Rot      (#FF3333)
v = 0.5–1.0    → Orange   (#FF9933)  
v = 0.2–0.5    → Gelb     (#FFFF33)
v < 0.2 m/s    → Grün     (#33FF33)
```

- Partikel verblassen und verschwinden bei v < 0.05 m/s
- Play/Pause/Reset-Steuerung
- Drallauslass: Spiralförmige Partikelwege
- Schlitzauslass: Fächerförmig
- Düse: Gerichteter Strahl

**FR-010: Reichweiten-Kegel**

- Halbtransparenter Kegel/Fächer vom Auslass
- Länge = berechnete Wurfweite x₀.₂
- Öffnungswinkel = Strahltyp-abhängig
- Farbe: Blau (Kühlung) / Rot (Heizung)

**FR-011: Geschwindigkeitszonen**

- Flächige Darstellung auf Schnittebene (Standard: 1.2 m Höhe)
- Farbcodierung wie Partikel
- Höhe der Schnittebene per Slider einstellbar (0–H)

**FR-012: Schall-Heatmap**

- Raster 0.5 × 0.5 m auf einstellbarer Höhe (Standard: 1.2 m)
- Farbcodierung:

```
< 25 dB(A)  → Dunkelgrün   (sehr leise)
25–30       → Grün          (leise)
30–35       → Hellgrün      (akzeptabel für Büro)
35–40       → Gelb          (grenzwertig)
40–45       → Orange        (zu laut für Büro)
> 45        → Rot           (zu laut)
```

- Überlagert mit Konturlinien bei Grenzwerten
- Messpunkte mit exakten dB(A)-Werten (auf Klick oder immer sichtbar)

**FR-013: Darstellungs-Umschaltung**

Toggle-Buttons in der Toolbar:
- [Partikel] [Kegel] [Zonen] [Schall] [Aus]
- Mehrere gleichzeitig aktivierbar
- Transparenz-Slider für Overlays

### 5.5 Projekt-Verwaltung (Phase 2)

**FR-014: Speichern**

- Format: `.hvac` (JSON, menschenlesbar)
- Enthält: Raumgeometrie, alle Auslässe mit Positionen/Parametern, Raumeigenschaften, Kameraposition, Berechnungsergebnisse
- Speichern per Download (Browser-Download-Dialog)
- Auto-Save im localStorage alle 60 Sekunden

**FR-015: Laden**

- Datei-Drop auf das Fenster oder File-Input-Button
- Validierung: Schema-Prüfung, Version-Check
- Szene wird komplett wiederhergestellt

**FR-016: Projektdatei-Schema (.hvac)**

```json
{
  "version": "2.0",
  "meta": {
    "name": "Besprechungsraum EG",
    "created": "2026-02-23T10:00:00Z",
    "modified": "2026-02-23T10:15:00Z",
    "author": "",
    "description": ""
  },
  "room": {
    "length": 8.0,
    "width": 6.0,
    "height": 3.2,
    "temperature": 22.0,
    "roomType": "meeting_room",
    "surfaces": {
      "ceiling":  { "material": "acoustic_tile", "alpha": 0.85 },
      "floor":    { "material": "carpet", "alpha": 0.30 },
      "wallN":    { "material": "plaster", "alpha": 0.03 },
      "wallE":    { "material": "glass", "alpha": 0.12 },
      "wallS":    { "material": "plaster", "alpha": 0.03 },
      "wallW":    { "material": "plaster", "alpha": 0.03 }
    }
  },
  "outlets": [
    {
      "id": "outlet_001",
      "type": "swirl",
      "size": "DN400",
      "position": { "x": 2.5, "y": 3.0, "z": 3.2 },
      "rotation": 0,
      "mounting": "ceiling",
      "params": {
        "volumeFlow": 500,
        "supplyTemp": 18.0
      }
    }
  ],
  "results": {
    "timestamp": "2026-02-23T10:14:00Z",
    "outlets": {
      "outlet_001": {
        "exitVelocity": 2.17,
        "throwDistance": 4.8,
        "pressureDrop": 42,
        "soundPowerLevel": 38,
        "maxVelocityOccupied": 0.16,
        "soundPressureAt3m": 28
      }
    },
    "room": {
      "totalSoundLevel": 28,
      "complianceStatus": "PASS",
      "comfortCategory": "II"
    }
  },
  "view": {
    "cameraPosition": { "x": 12, "y": 8, "z": 10 },
    "cameraTarget": { "x": 4, "y": 3, "z": 1.6 }
  }
}
```

### 5.6 PDF-Export (Phase 3)

**FR-017: Berichtserzeugung**

Per Knopfdruck wird ein PDF mit folgenden Seiten generiert:

1. **Deckblatt:**
   - Titel: "Lüftungsauslegung — [Projektname]"
   - Datum, Bearbeiter (optional)
   - 3D-Screenshot (Perspektive)

2. **Raumübersicht:**
   - Draufsicht-Screenshot
   - Tabelle: Raummaße, Fläche, Volumen, Raumtyp
   - Tabelle: Oberflächenmaterialien + Absorptionsgrade

3. **Auslass-Übersicht:**
   - Tabelle: Alle Auslässe mit Typ, Größe, Position, Volumenstrom, Temperatur
   - Berechnete Ergebnisse: Wurfweite, v₀, Δp, L_W

4. **Strömungsanalyse:**
   - Screenshot: Partikel-Ansicht
   - Screenshot: Geschwindigkeitszonen auf 1.2 m
   - Bewertung: Max. Geschwindigkeit in Aufenthaltszone, Komfortkategorie

5. **Schallanalyse:**
   - Screenshot: Schall-Heatmap
   - Tabelle: Schallpegel an Referenzpunkten
   - Bewertung: Einhaltung der Grenzwerte nach Raumtyp

6. **Zusammenfassung:**
   - Ampelbewertung: Strömung ✓/✗, Schall ✓/✗, Komfort ✓/✗
   - Hinweise und Empfehlungen (automatisch generiert)

**Format:** A4, Portrait, jsPDF

### 5.7 Mehrsprachigkeit (Phase 3)

- Alle UI-Strings in JSON-Dateien (`de.json`, `en.json`)
- Sprachwechsel per Button in der Toolbar (DE | EN)
- Technische Einheiten bleiben metrisch (SI)
- PDF-Bericht in der gewählten Sprache

---

## 6. User Interface — Layout & Wireframe

### 6.1 Gesamtlayout

```
┌──────────────────────────────────────────────────────────────┐
│  [≡ Menu]  HVAC Simulator  │  Projektname  │  [DE|EN] [?]  │
├───────┬──────────────────────────────────────────┬───────────┤
│       │                                          │           │
│  B    │                                          │  P        │
│  I    │         3D VIEWPORT                      │  R        │
│  B    │                                          │  O        │
│  L    │    (Three.js Canvas)                     │  P        │
│  I    │                                          │  E        │
│  O    │                                          │  R        │
│  T    │                                          │  T        │
│  H    │                                          │  I        │
│  E    │                                          │  E        │
│  K    │                                          │  S        │
│       │                                          │           │
│  160px│              flex-grow                    │  280px    │
├───────┴──────────────────────────────────────────┴───────────┤
│ [▶Play] [⏸] [⏹] │ [Partikel] [Kegel] [Zonen] [Schall]     │
│ Ansicht: [Perspektive ▾] │ Grid: [0.25m ▾] │ Schnitt: 1.2m │
├──────────────────────────────────────────────────────────────┤
│ Status: 2 Auslässe │ Berechnung: 0.3ms │ [💾 Speichern] [📄 PDF] │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Farbschema

| Element | Farbe | Hex |
|---------|-------|-----|
| Hintergrund 3D | Dunkelgrau | #1a1a2e |
| Raum-Boden | Hellgrau | #cccccc |
| Raum-Wände | Weiß, 30% Opacity | #ffffff4d |
| Raum-Gitter | Dunkelgrau, 20% | #33333333 |
| Sidebar | Dunkel | #16213e |
| Properties | Weiß | #ffffff |
| Akzentfarbe | Blau | #0f3460 |
| Erfolg | Grün | #4caf50 |
| Warnung | Orange | #ff9800 |
| Fehler | Rot | #f44336 |

### 6.3 Responsive Verhalten

- Mindestbreite: 1024 px
- Bei < 1200 px: Sidebar collapsed (nur Icons)
- Properties-Panel: Unterhalb des Viewports auf schmalen Bildschirmen
- Touch-Unterstützung: Pinch-to-Zoom, Two-Finger-Rotate

---

## 7. User Flow — Schritt für Schritt

### 7.1 Happy Path

```
Nutzer öffnet index.html
    │
    ▼
Willkommens-Dialog
  "Neues Projekt" │ "Beispiel laden" │ "Projekt öffnen (.hvac)"
    │
    ▼
Raum-Dialog (Modal)
  Länge [___] m    Breite [___] m    Höhe [___] m
  Raumtyp: [Büro ▾]
  [Erstellen]
    │
    ▼
3D-Raum sichtbar — Orbit-Steuerung aktiv
Sidebar zeigt Auslass-Bibliothek
    │
    ▼
Nutzer klickt "Drallauslass DN 400" in der Sidebar
  → Auslass hängt am Cursor
  → Hover über Decke → Snap-Indikator
  → Klick → platziert
    │
    ▼
Properties-Panel öffnet sich rechts
  → Nutzer stellt Volumenstrom auf 500 m³/h
  → Zulufttemperatur auf 18 °C
  → Live-Berechnung zeigt: Wurfweite 4.8 m, v₀ = 2.2 m/s
    │
    ▼
Nutzer klickt [Partikel ▶]
  → Animation startet, Partikel strömen vom Auslass
  → Farbcodierung zeigt Geschwindigkeitsabfall
    │
    ▼
Nutzer klickt [Schall]
  → Heatmap-Overlay auf 1.2 m Höhe
  → Schallpegel sichtbar, grüne Fläche → OK
    │
    ▼
Nutzer klickt [💾 Speichern]
  → Download: "besprechungsraum.hvac"
    │
    ▼
Nutzer klickt [📄 PDF]
  → PDF wird generiert und heruntergeladen
```

### 7.2 Fehlerszenarien

| Situation | Verhalten |
|-----------|----------|
| Ungültige Raummaße (≤0, zu groß) | Inline-Fehler am Eingabefeld, Button deaktiviert |
| Auslass außerhalb des Raums | Roter Indikator, Platzierung verweigert |
| Volumenstrom = 0 | Warnung im Properties-Panel, Berechnung zeigt "—" |
| Browser ohne WebGL | Fehlermeldung beim Start mit Link zu Troubleshooting |
| Korrupte .hvac-Datei | Fehlerdialog: "Datei konnte nicht gelesen werden" |
| > 20 Auslässe (Performance) | Warnung: "Viele Auslässe können die Performance beeinträchtigen" |

---

## 8. Nicht-Funktionale Anforderungen

### 8.1 Performance

| Metrik | Zielwert |
|--------|----------|
| Startup (index.html laden) | < 2 Sekunden |
| Raum erstellen | < 100 ms |
| Auslass platzieren | < 50 ms |
| Berechnung (1 Auslass) | < 5 ms |
| Berechnung (10 Auslässe) | < 50 ms |
| Partikel-Animation | ≥ 30 FPS (1000 Partikel) |
| 3D-Navigation | ≥ 60 FPS |
| PDF-Export | < 5 Sekunden |
| Speichern/Laden | < 200 ms |

### 8.2 Kompatibilität

- Chrome 90+, Firefox 90+, Edge 90+, Safari 16+
- WebGL 2.0 erforderlich
- Mindestauflösung: 1024 × 768 px
- Maus + Tastatur primär, Touch sekundär

### 8.3 Barrierefreiheit

- Tastaturnavigation für alle UI-Elemente
- ARIA-Labels auf interaktiven Elementen
- Farben mit ausreichendem Kontrast (WCAG AA)
- Tooltip-Texte für alle Icons

### 8.4 Sicherheit & Privatsphäre

- Keine Netzwerk-Requests, keine Tracking, keine Cookies
- Alle Daten bleiben lokal (localStorage + Downloads)
- Keine externe API-Aufrufe
- Content Security Policy im HTML-Head

---

## 9. Entwicklungs-Roadmap

### Phase 1: Fundament (Woche 1–2)

**Ziel:** Ein Raum, ein Auslass, Berechnung sichtbar.

| Task | Aufwand | Priorität |
|------|---------|-----------|
| Projekt-Boilerplate (HTML, CSS, JS-Module) | 2h | P0 |
| Three.js Scene Setup (Renderer, Camera, Lights) | 3h | P0 |
| OrbitControls + Preset-Ansichten | 2h | P0 |
| roomBuilder.js: Quaderraum mit Grid | 4h | P0 |
| Raum-Erstellungs-Modal (L × B × H) | 2h | P0 |
| diffuserDB.js: Datenkatalog (4 Typen) | 3h | P0 |
| jetPhysics.js: Freistrahl + Coanda-Formeln | 6h | P0 |
| Sidebar: Auslass-Bibliothek (statisch) | 3h | P0 |
| outletPlacer.js: Klick-Platzierung auf Decke | 6h | P0 |
| properties.js: Parameter-Panel mit Live-Berechnung | 4h | P0 |
| Reichweiten-Kegel-Visualisierung | 3h | P0 |

**Deliverable:** Raum erstellen, Auslass platzieren, Wurfweite sehen.

### Phase 2: Visualisierung & Interaktion (Woche 3–4)

| Task | Aufwand | Priorität |
|------|---------|-----------|
| GPU-Partikelsystem (ShaderMaterial) | 8h | P0 |
| Partikel folgen Geschwindigkeitsfeld | 6h | P0 |
| Farbcodierung nach Geschwindigkeit | 2h | P0 |
| Drag & Drop Platzierung (statt nur Klick) | 4h | P1 |
| Snap-to-Grid auf allen Flächen | 4h | P1 |
| Auslass verschieben/rotieren | 4h | P1 |
| Geschwindigkeitszonen (Schnittebene) | 6h | P1 |
| acoustics.js: Schallberechnung | 4h | P1 |
| Schall-Heatmap-Overlay | 6h | P1 |
| projectFile.js: JSON Save/Load | 3h | P1 |
| localStorage Auto-Save | 1h | P2 |

**Deliverable:** Vollständige Simulation (Luft + Schall), Speichern/Laden.

### Phase 3: Polish & Export (Woche 5–6)

| Task | Aufwand | Priorität |
|------|---------|-----------|
| comfort.js: Komfortbewertung, Zugluftrate | 4h | P1 |
| Ampel-Bewertung im UI | 2h | P1 |
| pdfExport.js: PDF-Generierung (6 Seiten) | 8h | P1 |
| i18n.js: DE/EN Umschaltung | 3h | P2 |
| Toolbar: Darstellungs-Toggles | 2h | P1 |
| Schnittebenen-Slider (Höhe einstellbar) | 3h | P2 |
| Raumeigenschaften (Materialien, Absorption) | 3h | P2 |
| Willkommens-Dialog + Beispielprojekte | 2h | P2 |
| Keyboard-Shortcuts | 2h | P2 |
| Performance-Optimierung (LOD, Culling) | 4h | P2 |

**Deliverable:** v1.0 — Vollständig nutzbar, PDF-Export, zweisprachig.

### Phase 4: Erweiterungen (Woche 7–10, optional)

| Task | Aufwand | Priorität |
|------|---------|-----------|
| Mehrere Auslässe: vereinfachte Strahlinteraktion | 8h | P2 |
| Undo/Redo System | 4h | P2 |
| 3D-Modelle für Auslässe (GLB) | 6h | P3 |
| Abluft-Auslässe (Senken) | 4h | P3 |
| Tauri-Wrapper für Desktop-EXE | 4h | P3 |
| Hindernisse (Säulen, Möbel) als Boxen | 6h | P3 |
| Vergleichsmodus (2 Varianten nebeneinander) | 8h | P3 |
| Erweiterter PDF mit Logo-Upload | 4h | P3 |

### Gesamtaufwand (Phase 1–3)

- **Geschätzt:** ~120 Stunden Entwicklung
- **Zeitrahmen:** 6 Wochen bei 20h/Woche, oder 3 Wochen bei 40h/Woche
- **Vergleich zum alten PRD:** 14 Wochen mit 6 Technologien → 6 Wochen mit 1 Technologie

---

## 10. Technische Implementierungsdetails

### 10.1 Three.js Scene-Architektur

```javascript
// Szene-Hierarchie
Scene
├── AmbientLight (0x404040, 0.6)
├── DirectionalLight (0xffffff, 0.8)
├── RoomGroup
│   ├── FloorMesh (PlaneGeometry, MeshStandardMaterial)
│   ├── WallsMesh (BoxGeometry edges, MeshBasicMaterial transparent)
│   ├── GridHelper (0.5m Raster)
│   └── DimensionLabels (CSS2DRenderer)
├── OutletsGroup
│   ├── Outlet_001 (Group: Mesh + RangeCone + Label)
│   ├── Outlet_002 ...
│   └── ...
├── VisualizationGroup
│   ├── ParticleSystem (Points, ShaderMaterial)
│   ├── VelocitySliceMesh (PlaneGeometry, DataTexture)
│   └── SoundHeatmapMesh (PlaneGeometry, DataTexture)
└── HelperGroup
    ├── SnapIndicator
    └── SelectionHighlight
```

### 10.2 Partikelsystem-Design

```
Architektur: GPU-basiert (Vertex Shader berechnet Positionen)

Datenstruktur pro Partikel:
  - position (vec3) — aktueller Ort
  - velocity (vec3) — aktuelle Geschwindigkeit
  - age (float) — Lebenszeit
  - seed (float) — Randomisierung

Update-Logik (im Vertex Shader oder JS):
  1. Berechne Geschwindigkeit am aktuellen Ort aus Jet-Formel
  2. Addiere turbulente Fluktuation (Perlin Noise oder Random)
  3. Integriere Position: p_new = p_old + v * dt
  4. Falls v < 0.05 m/s oder age > maxAge → Reset zum Auslass
  5. Farbe = Mapping(|v|) über Farb-Rampe

Partikel-Budget:
  - Bis 5 Auslässe: 500 Partikel/Auslass
  - 6–10 Auslässe: 250 Partikel/Auslass
  - > 10: 100 Partikel/Auslass
```

### 10.3 Berechnung: Aufrufkette

```
Nutzer ändert Parameter
    │
    ▼
properties.js: onChange Event
    │
    ▼
jetPhysics.js: calculateOutlet(outlet, room) → JetResult
  ├── exitVelocity: v₀ = V̇ / A_eff
  ├── throwDistance: x₀.₂ = f(v₀, d₀, K₁, Coanda?)
  ├── detachmentPoint: x_ablöse = f(Ar) (nur bei ΔT > 0)
  ├── velocityField: v(x,y,z) für Partikel + Zonen
  └── maxVelocityInOccupied: max(v) für z ∈ [0.1, 1.8]
    │
    ▼
acoustics.js: calculateSound(outlets[], room) → SoundResult
  ├── perOutlet: L_W(V̇), L_p(r) für Rasterpunkte
  ├── total: L_gesamt = 10·log10(Σ...)
  └── heatmapGrid: dB(A) pro 0.5m × 0.5m
    │
    ▼
comfort.js: evaluateComfort(jetResult, soundResult, room) → ComfortResult
  ├── velocityCompliance: max(v) vs Grenzwert
  ├── draughtRate: DR am kritischsten Punkt
  ├── soundCompliance: L_gesamt vs Raumtyp-Grenzwert
  └── overallCategory: I / II / III / FAIL
    │
    ▼
visualization.js: updateVisualization(jetResult, soundResult)
  ├── Partikel-Velocity-Field aktualisieren
  ├── Reichweiten-Kegel updaten
  ├── Geschwindigkeitszonen-Textur updaten
  └── Schall-Heatmap-Textur updaten
    │
    ▼
properties.js: updateResultDisplay(comfortResult)
  └── Ergebnisse + Ampeln im Properties-Panel anzeigen
```

---

## 11. Risiken & Mitigationen

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|-----------|
| Three.js Partikel-Performance auf schwacher GPU | Mittel | Mittel | LOD: Partikelzahl dynamisch anpassen, Fallback auf statische Kegel |
| Analytische Formeln zu ungenau für komplexe Räume | Gering | Gering | Klare Kommunikation: "Vorauslegung", nicht "CFD". Hinweis im PDF |
| Browser-Kompatibilität (Safari WebGL) | Gering | Gering | WebGL-Feature-Detection beim Start |
| PDF-Screenshot-Qualität (html2canvas) | Mittel | Gering | Dedicated Render-Pass für PDF (höhere Auflösung) |
| Nutzer erwarten CFD-Genauigkeit | Mittel | Mittel | Klares Wording: "Auslegungstools" / "Schnellberechnung nach VDI" |
| Scope Creep (IFC-Import, Multi-Room) | Hoch | Hoch | Strikt: Erst v1.0 fertig, dann erweitern |

---

## 12. Zukunftsvision (Post v1.0)

Nach einer stabilen v1.0 können folgende Features **einzeln und unabhängig** hinzugefügt werden:

1. **Tauri Desktop-Wrapper** — gleicher Code, als .exe verpackt
2. **Erweiterter Raumdesigner** — L-förmige Räume, abgehängte Decken, Hindernisse
3. **IFC-Import** — mit web-ifc (rein clientseitig)
4. **OpenFOAM-Anbindung** — als optionaler separater Service (Docker), nicht im Kern
5. **Herstellerkataloge** — echte Produktdaten von Trox, Schako, Lindab etc. als JSON
6. **Variantenvergleich** — Split-Screen mit zwei Konfigurationen
7. **Thermische Simulation** — Temperaturschichtung, Wärmelasten
8. **PWA (Progressive Web App)** — installierbar, Offline-Cache, App-Icon

Jedes dieser Features ist ein eigenes, abgeschlossenes Paket — kein Feature blockiert ein anderes.

---

## 13. Glossar

| Begriff | Erklärung |
|---------|----------|
| **Wurfweite (Throw)** | Entfernung vom Auslass, bei der die Geschwindigkeit auf den Terminalwert (z.B. 0.2 m/s) abgefallen ist |
| **Coanda-Effekt** | Anhaftung eines Luftstrahls an einer Oberfläche (Decke), verlängert die Wurfweite um Faktor √2 |
| **Induktion** | Mitreißen von Raumluft durch den Primärstrahl; Induktionsverhältnis = V_induziert / V_primär |
| **Archimedes-Zahl (Ar)** | Dimensionslose Kennzahl für das Verhältnis von Auftriebskraft zu Trägheitskraft |
| **L_W** | Schallleistungspegel [dB(A)] — Eigenschaft der Quelle |
| **L_p** | Schalldruckpegel [dB(A)] — am Empfängerort, entfernungsabhängig |
| **DR (Draught Rate)** | Zugluftrate [%] — Prozentsatz unzufriedener Personen durch Zugluft |
| **PMV/PPD** | Predicted Mean Vote / Predicted Percentage Dissatisfied — Komfortindex nach ISO 7730 |
| **ADPI** | Air Diffusion Performance Index — Bewertung der Raumluftverteilung |
| **Aufenthaltszone** | Bereich, in dem sich Personen aufhalten (0.1–1.8 m Höhe, 0.5 m Wandabstand) |

---

## 14. Referenzen & Normen

### Normen
- **VDI 3803 Blatt 1** (2020-05): Raumlufttechnik — Bauliche und technische Anforderungen
- **DIN EN 12238** (2001): Lüftung — Luftdurchlässe — Aerodynamische Prüfung und Bewertung
- **DIN 1946-2**: Raumlufttechnik — Gesundheitstechnische Anforderungen
- **DIN EN 12354**: Bauakustik — Berechnung der akustischen Eigenschaften von Gebäuden
- **DIN EN 16798-1**: Energetische Bewertung — Eingangsparameter für Raumklima
- **ISO 7730**: Ergonomie — Analytische Bewertung thermischer Umgebungen
- **ASHRAE Handbook — Fundamentals** (2021): Chapter 20: Space Air Diffusion

### Fachliteratur
- Recknagel, Sprenger, Schramek: Taschenbuch für Heizung + Klimatechnik
- H. Schlichting, K. Gersten: Grenzschicht-Theorie (Freistrahl-Grundlagen)
- ASHRAE Standard 70: Method of Testing Air Terminal Devices

### Referenz-Software (zum Vergleich)
- Lindab ICD (Indoor Climate Designer): lindqst.com
- Trox EasySelect: trox.de
- Swegon ProSelect: swegon.com
- Halton HIT Design Tool: halton.com

---

## 15. Changelog

| Version | Datum | Änderungen |
|---------|-------|-----------|
| 1.0 | 2026-02-23 | Initiales PRD — Web-First, analytische Strahltheorie, inkrementeller Aufbau |

---

**Nächster Schritt:** Phase 1, Task 1 — `index.html` + Three.js Scene Setup. Sofort startbar, kein Setup nötig. 🚀
