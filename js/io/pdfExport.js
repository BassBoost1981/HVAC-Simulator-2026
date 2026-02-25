// ============================================================
// pdfExport.js — 6-page PDF report generator
// Uses jsPDF (global) + html2canvas (global) + Three.js canvas
// ============================================================

import { ROOM_TYPES, DIFFUSER_TYPES, EXHAUST_TYPES, SURFACE_MATERIALS, SLOT_DIRECTIONS } from '../simulation/diffuserDB.js';
import { getComfortSummary } from '../simulation/comfort.js';
import { getLang } from '../ui/i18n.js';
import sceneManager from '../scene/sceneManager.js';

// A4 dimensions in mm
const A4_W = 210;
const A4_H = 297;
const MARGIN = 15;
const CONTENT_W = A4_W - 2 * MARGIN;

// Colors
const ACCENT = [15, 52, 96];       // #0f3460
const HEADER_BG = [22, 33, 62];    // #16213e
const TEXT_DARK = [30, 30, 40];
const TEXT_MID = [100, 100, 120];
const GREEN = [76, 175, 80];
const YELLOW = [255, 193, 7];
const RED = [244, 67, 54];

/**
 * Generate and download a 6-page PDF report
 *
 * @param {Object} state - Full application state
 * @param {Object} comfortResult - From evaluateComfort()
 */
export async function exportPDF(state, comfortResult) {
    const lang = getLang();
    const t = _getStrings(lang);

    // Access jsPDF from global (loaded via UMD script tag)
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Capture 3D viewport screenshots before generating pages
    const screenshots = await _captureScreenshots();

    // Page 1: Cover
    _drawCoverPage(doc, state, screenshots.perspective, t);

    // Page 2: Room Overview
    doc.addPage();
    _drawRoomOverview(doc, state, screenshots.topDown, t);

    // Page 3: Outlet Overview
    doc.addPage();
    _drawOutletOverview(doc, state, t);

    // Page 4: Airflow Analysis
    doc.addPage();
    _drawAirflowAnalysis(doc, state, comfortResult, screenshots.particles, t);

    // Page 5: Sound Analysis
    doc.addPage();
    _drawSoundAnalysis(doc, state, comfortResult, screenshots.sound, t);

    // Page 6: Summary
    doc.addPage();
    _drawSummary(doc, state, comfortResult, t);

    // Download
    const filename = state.projectName
        ? `${state.projectName}.pdf`
        : `hvac_report_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
}

// ================================================================
//  SCREENSHOT CAPTURE
// ================================================================

async function _captureScreenshots() {
    const canvas = sceneManager.canvas;

    // Take screenshot of current view (perspective)
    sceneManager.renderer.render(sceneManager.scene, sceneManager.camera);
    const perspective = canvas.toDataURL('image/png');

    // Save current camera state
    const camPos = sceneManager.camera.position.clone();
    const camTarget = sceneManager.controls.target.clone();

    // Top-down view
    const room = _getRoomDimensions();
    if (room) {
        const maxDim = Math.max(room.length, room.width) * 0.8;
        sceneManager.camera.position.set(0, maxDim + 2, 0.01);
        sceneManager.controls.target.set(0, 0, 0);
        sceneManager.controls.update();
        sceneManager.renderer.render(sceneManager.scene, sceneManager.camera);
    }
    const topDown = canvas.toDataURL('image/png');

    // Restore camera
    sceneManager.camera.position.copy(camPos);
    sceneManager.controls.target.copy(camTarget);
    sceneManager.controls.update();
    sceneManager.renderer.render(sceneManager.scene, sceneManager.camera);

    return { perspective, topDown, particles: perspective, sound: perspective };
}

function _getRoomDimensions() {
    // We'll pass this externally; for now use a simple approach
    return null;
}

// ================================================================
//  PAGE 1: COVER
// ================================================================

function _drawCoverPage(doc, state, screenshot, t) {
    // Header background
    doc.setFillColor(...HEADER_BG);
    doc.rect(0, 0, A4_W, 80, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.text(t.title, MARGIN, 35);

    doc.setFontSize(14);
    doc.setTextColor(180, 200, 220);
    const projectName = state.projectName || _buildProjectName(state);
    doc.text(projectName, MARGIN, 50);

    // Date
    doc.setFontSize(10);
    doc.text(new Date().toLocaleDateString(getLang() === 'de' ? 'de-DE' : 'en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    }), MARGIN, 65);

    // 3D screenshot
    if (screenshot) {
        try {
            doc.addImage(screenshot, 'PNG', MARGIN, 90, CONTENT_W, CONTENT_W * 0.6);
        } catch (e) { /* screenshot failed */ }
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MID);
    doc.text('HVAC Simulator — Airflow & Sound Analysis', MARGIN, A4_H - 10);
    doc.text('1 / 6', A4_W - MARGIN, A4_H - 10, { align: 'right' });
}

// ================================================================
//  PAGE 2: ROOM OVERVIEW
// ================================================================

function _drawRoomOverview(doc, state, screenshot, t) {
    _drawPageHeader(doc, t.roomOverview, '2 / 6');

    let y = 35;

    // Top-down screenshot
    if (screenshot) {
        try {
            const imgH = CONTENT_W * 0.55;
            doc.addImage(screenshot, 'PNG', MARGIN, y, CONTENT_W, imgH);
            y += imgH + 8;
        } catch (e) { y += 5; }
    }

    // Room dimensions table
    const room = state.room;
    if (!room) return;

    const roomType = ROOM_TYPES[room.roomType];

    y = _drawSectionTitle(doc, t.roomDimensions, y);
    const dimData = [
        [t.length, `${room.length} m`],
        [t.width, `${room.width} m`],
        [t.height, `${room.height} m`],
        [t.area, `${(room.length * room.width).toFixed(1)} m²`],
        [t.volume, `${(room.length * room.width * room.height).toFixed(1)} m³`],
        [t.roomType, roomType ? (getLang() === 'de' ? roomType.nameDE : roomType.nameEN) : room.roomType],
        [t.temperature, `${room.temperature} °C`],
        [t.soundLimit, roomType ? `${roomType.maxDbA} dB(A)` : '—']
    ];
    y = _drawTable(doc, dimData, y, [CONTENT_W * 0.5, CONTENT_W * 0.5]);

    // Surface materials
    if (room.surfaces) {
        y += 5;
        y = _drawSectionTitle(doc, t.surfaces, y);
        const surfData = [
            [t.ceiling, _materialName(room.surfaces.ceiling, t), `α = ${room.surfaces.ceiling.alpha}`],
            [t.floor, _materialName(room.surfaces.floor, t), `α = ${room.surfaces.floor.alpha}`],
            [t.walls, _materialName(room.surfaces.wallNS, t), `α = ${room.surfaces.wallNS.alpha}`]
        ];
        y = _drawTable(doc, surfData, y, [CONTENT_W * 0.25, CONTENT_W * 0.45, CONTENT_W * 0.3]);
    }

    _drawFooter(doc, '2 / 6');
}

// ================================================================
//  PAGE 3: OUTLET OVERVIEW
// ================================================================

function _drawOutletOverview(doc, state, t) {
    _drawPageHeader(doc, t.outletOverview, '3 / 6');

    let y = 35;

    // Separate supply and exhaust outlets
    const supplyOutlets = [];
    const exhaustOutlets = [];
    state.outlets.forEach((outlet, id) => {
        const result = state.results.get(id);
        if (outlet.outletCategory === 'exhaust') {
            exhaustOutlets.push({ outlet, id, result });
        } else {
            supplyOutlets.push({ outlet, id, result });
        }
    });

    // Supply table
    if (supplyOutlets.length > 0) {
        const supplyTitle = getLang() === 'de' ? 'Zuluftauslässe' : 'Supply Outlets';
        y = _drawSectionTitle(doc, supplyTitle, y);
        y = _drawOutletTable(doc, supplyOutlets, y, false, t);
    }

    // Exhaust table
    if (exhaustOutlets.length > 0) {
        y += 4;
        const exhaustTitle = getLang() === 'de' ? 'Abluftauslässe' : 'Exhaust Outlets';
        y = _drawSectionTitle(doc, exhaustTitle, y);
        y = _drawOutletTable(doc, exhaustOutlets, y, true, t);
    }

    // Balance box
    let supplyTotal = 0, exhaustTotal = 0;
    supplyOutlets.forEach(o => supplyTotal += o.outlet.volumeFlow);
    exhaustOutlets.forEach(o => exhaustTotal += o.outlet.volumeFlow);
    if (supplyOutlets.length > 0 || exhaustOutlets.length > 0) {
        y += 6;
        const avg = (supplyTotal + exhaustTotal) / 2;
        const diffPct = avg > 0 ? Math.abs(supplyTotal - exhaustTotal) / avg * 100 : 0;
        const balanceColor = diffPct <= 5 ? GREEN : diffPct <= 10 ? YELLOW : RED;

        doc.setFillColor(245, 247, 252);
        doc.roundedRect(MARGIN, y, CONTENT_W, 14, 2, 2, 'F');
        doc.setFontSize(9);
        doc.setTextColor(...TEXT_DARK);
        const balanceLabel = getLang() === 'de' ? 'Bilanz' : 'Balance';
        doc.text(`${balanceLabel}: \u03A3 ${getLang() === 'de' ? 'Zuluft' : 'Supply'}: ${Math.round(supplyTotal)} m\u00B3/h | \u03A3 ${getLang() === 'de' ? 'Abluft' : 'Exhaust'}: ${Math.round(exhaustTotal)} m\u00B3/h | ${getLang() === 'de' ? 'Differenz' : 'Difference'}: ${diffPct.toFixed(0)}%`, MARGIN + 4, y + 9);
        // Color indicator
        doc.setFillColor(...balanceColor);
        doc.circle(MARGIN + CONTENT_W - 8, y + 7, 3, 'F');
    }

    _drawFooter(doc, '3 / 6');
}

function _drawOutletTable(doc, outletList, y, isExhaust, t) {
    const throwHeader = isExhaust ? (getLang() === 'de' ? 'Saugr.' : 'Suct.') : 'x₀.₂ [m]';
    const headers = [t.nr, t.type, t.size, t.dir || 'Richt.', 'X [m]', 'Z [m]', 'V̇ [m³/h]', 'v₀ [m/s]', throwHeader, 'Δp [Pa]', 'Lw [dB(A)]'];
    const colWidths = [8, 20, 18, 14, 14, 14, 18, 16, 16, 14, 20];

    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(...(isExhaust ? [140, 100, 50] : ACCENT));
    doc.rect(MARGIN, y, CONTENT_W, 6, 'F');

    let x = MARGIN + 1;
    headers.forEach((h, i) => {
        doc.text(h, x, y + 4.2);
        x += colWidths[i];
    });
    y += 7;

    doc.setTextColor(...TEXT_DARK);
    outletList.forEach(({ outlet, result }, idx) => {
        const typeCatalog = isExhaust ? EXHAUST_TYPES : DIFFUSER_TYPES;
        const typeDE = typeCatalog[outlet.typeKey]?.nameDE || outlet.typeKey;
        const sizeName = outlet.sizeData?.name || '—';

        if (idx % 2 === 0) {
            doc.setFillColor(240, 242, 248);
            doc.rect(MARGIN, y - 0.5, CONTENT_W, 5.5, 'F');
        }

        doc.setFontSize(7);
        x = MARGIN + 1;

        let dirLabel = '—';
        if (outlet.typeKey === 'slot' && outlet.slotDirection) {
            const dirData = SLOT_DIRECTIONS[outlet.slotDirection];
            if (dirData) {
                dirLabel = getLang() === 'de' ? dirData.nameDE.substring(0, 6) : dirData.nameEN.substring(0, 6);
            }
        }

        const row = [
            `${idx + 1}`,
            typeDE,
            sizeName,
            dirLabel,
            outlet.position3D.x.toFixed(2),
            outlet.position3D.z.toFixed(2),
            `${outlet.volumeFlow}`,
            result ? result.exitVelocity.toFixed(2) : '—',
            result ? result.throwDistance.toFixed(1) : '—',
            result ? result.pressureDrop.toFixed(0) : '—',
            result ? result.soundPowerLevel.toFixed(1) : '—'
        ];
        row.forEach((cell, i) => {
            doc.text(cell, x, y + 3.5);
            x += colWidths[i];
        });
        y += 5.5;

        if (y > A4_H - 30) return;
    });

    return y;
}

// ================================================================
//  PAGE 4: AIRFLOW ANALYSIS
// ================================================================

function _drawAirflowAnalysis(doc, state, comfortResult, screenshot, t) {
    _drawPageHeader(doc, t.airflowAnalysis, '4 / 6');

    let y = 35;

    // Screenshot
    if (screenshot) {
        try {
            const imgH = CONTENT_W * 0.5;
            doc.addImage(screenshot, 'PNG', MARGIN, y, CONTENT_W, imgH);
            y += imgH + 8;
        } catch (e) { y += 5; }
    }

    y = _drawSectionTitle(doc, t.velocityEval, y);

    if (comfortResult) {
        const data = [
            [t.maxVOccupied, `${comfortResult.maxVelocityOccupied.toFixed(2)} m/s`],
            [t.velocityCategory, comfortResult.velocityCategory],
            [t.draughtRate, `${comfortResult.draughtRate.toFixed(1)} %`],
            [t.draughtRateOk, comfortResult.draughtRateOk ? '✓' : '✗']
        ];
        y = _drawTable(doc, data, y, [CONTENT_W * 0.6, CONTENT_W * 0.4]);
    } else {
        doc.setFontSize(9);
        doc.setTextColor(...TEXT_MID);
        doc.text(t.noData, MARGIN, y + 5);
        y += 10;
    }

    _drawFooter(doc, '4 / 6');
}

// ================================================================
//  PAGE 5: SOUND ANALYSIS
// ================================================================

function _drawSoundAnalysis(doc, state, comfortResult, screenshot, t) {
    _drawPageHeader(doc, t.soundAnalysis, '5 / 6');

    let y = 35;

    // Screenshot
    if (screenshot) {
        try {
            const imgH = CONTENT_W * 0.5;
            doc.addImage(screenshot, 'PNG', MARGIN, y, CONTENT_W, imgH);
            y += imgH + 8;
        } catch (e) { y += 5; }
    }

    y = _drawSectionTitle(doc, t.soundEval, y);

    if (comfortResult) {
        const data = [
            [t.totalSound, `${comfortResult.totalSoundLevel.toFixed(1)} dB(A)`],
            [t.soundLimit, `${comfortResult.soundLimit} dB(A)`],
            [t.soundMargin, `${comfortResult.soundMargin.toFixed(1)} dB(A)`],
            [t.soundCompliant, comfortResult.soundCompliant ? '✓' : '✗']
        ];
        y = _drawTable(doc, data, y, [CONTENT_W * 0.6, CONTENT_W * 0.4]);
    }

    // Per-outlet sound levels
    y += 5;
    y = _drawSectionTitle(doc, t.outletSoundLevels, y);
    let idx = 0;
    state.outlets.forEach((outlet, id) => {
        idx++;
        const result = state.results.get(id);
        if (!result) return;
        const isExhaust = outlet.outletCategory === 'exhaust';
        const typeCatalog = isExhaust ? EXHAUST_TYPES : DIFFUSER_TYPES;
        const typeName = typeCatalog[outlet.typeKey]?.nameDE || outlet.typeKey;
        const prefix = isExhaust ? '[Abluft] ' : '';
        doc.setFontSize(8);
        doc.setTextColor(...TEXT_DARK);
        doc.text(
            `${idx}. ${prefix}${typeName} — Lw: ${result.soundPowerLevel.toFixed(1)} dB(A), Lp@3m: ${result.soundPressureAt3m.toFixed(1)} dB(A)`,
            MARGIN, y + 4
        );
        y += 5.5;
    });

    _drawFooter(doc, '5 / 6');
}

// ================================================================
//  PAGE 6: SUMMARY
// ================================================================

function _drawSummary(doc, state, comfortResult, t) {
    _drawPageHeader(doc, t.summary, '6 / 6');

    let y = 40;

    // Traffic-light boxes
    y = _drawTrafficLightBox(doc, t.airflow, _getFlowStatus(comfortResult), y, t);
    y += 5;
    y = _drawTrafficLightBox(doc, t.sound, _getSoundStatus(comfortResult), y, t);
    y += 5;
    y = _drawTrafficLightBox(doc, t.comfort, _getComfortStatus(comfortResult), y, t);
    y += 5;

    // Balance traffic light
    const balanceLabel = getLang() === 'de' ? 'Volumenstrom-Bilanz' : 'Volume Flow Balance';
    const balanceStatus = _getBalanceStatus(state);
    y = _drawTrafficLightBox(doc, balanceLabel, balanceStatus, y, t);

    // Recommendations
    y += 12;
    y = _drawSectionTitle(doc, t.recommendations, y);

    if (comfortResult) {
        const summary = getComfortSummary(comfortResult, getLang());
        doc.setFontSize(10);
        doc.setTextColor(...TEXT_DARK);
        doc.text(summary.categoryLabel, MARGIN, y + 5);
        y += 10;

        doc.setFontSize(9);
        for (const rec of summary.recommendations) {
            const lines = doc.splitTextToSize(`• ${rec}`, CONTENT_W);
            doc.text(lines, MARGIN, y + 4);
            y += lines.length * 5;
        }
    }

    // Footer with generation note
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MID);
    doc.text(
        t.generated + ' ' + new Date().toLocaleString(getLang() === 'de' ? 'de-DE' : 'en-US'),
        MARGIN, A4_H - 15
    );
    _drawFooter(doc, '6 / 6');
}

// ================================================================
//  DRAWING HELPERS
// ================================================================

function _drawPageHeader(doc, title, pageNum) {
    doc.setFillColor(...ACCENT);
    doc.rect(0, 0, A4_W, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(title, MARGIN, 16);
    doc.setFontSize(9);
    doc.text(pageNum, A4_W - MARGIN, 16, { align: 'right' });
}

function _drawFooter(doc, pageNum) {
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MID);
    doc.text('HVAC Simulator', MARGIN, A4_H - 6);
    doc.text(pageNum, A4_W - MARGIN, A4_H - 6, { align: 'right' });
}

function _drawSectionTitle(doc, title, y) {
    doc.setFontSize(11);
    doc.setTextColor(...ACCENT);
    doc.text(title, MARGIN, y + 5);
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y + 7, MARGIN + CONTENT_W, y + 7);
    return y + 11;
}

function _drawTable(doc, rows, startY, colWidths) {
    let y = startY;
    for (let r = 0; r < rows.length; r++) {
        if (r % 2 === 0) {
            doc.setFillColor(245, 247, 252);
            doc.rect(MARGIN, y, CONTENT_W, 6, 'F');
        }
        doc.setFontSize(8.5);
        doc.setTextColor(...TEXT_DARK);
        let x = MARGIN + 2;
        rows[r].forEach((cell, c) => {
            if (c === 0) {
                doc.setTextColor(...TEXT_MID);
            } else {
                doc.setTextColor(...TEXT_DARK);
            }
            doc.text(String(cell), x, y + 4.2);
            x += colWidths[c];
        });
        y += 6;
    }
    return y;
}

function _drawTrafficLightBox(doc, label, status, y, t) {
    const color = status === 'pass' ? GREEN : status === 'warn' ? YELLOW : RED;
    const statusText = status === 'pass' ? (t.pass || '✓ OK') : status === 'warn' ? (t.warn || '⚠') : (t.fail || '✗ FAIL');

    // Background
    doc.setFillColor(250, 250, 255);
    doc.roundedRect(MARGIN, y, CONTENT_W, 18, 3, 3, 'F');

    // Color indicator
    doc.setFillColor(...color);
    doc.circle(MARGIN + 9, y + 9, 5, 'F');

    // Label
    doc.setFontSize(12);
    doc.setTextColor(...TEXT_DARK);
    doc.text(label, MARGIN + 20, y + 11);

    // Status
    doc.setFontSize(11);
    doc.setTextColor(...color);
    doc.text(statusText, A4_W - MARGIN - 5, y + 11, { align: 'right' });

    return y + 20;
}

function _getFlowStatus(comfort) {
    if (!comfort) return 'fail';
    if (comfort.velocityCategory === 'I' || comfort.velocityCategory === 'II') return 'pass';
    if (comfort.velocityCategory === 'III') return 'warn';
    return 'fail';
}

function _getSoundStatus(comfort) {
    if (!comfort) return 'fail';
    if (comfort.soundCompliant && comfort.soundMargin > 5) return 'pass';
    if (comfort.soundCompliant) return 'warn';
    return 'fail';
}

function _getComfortStatus(comfort) {
    if (!comfort) return 'fail';
    if (comfort.overallCategory === 'I' || comfort.overallCategory === 'II') return 'pass';
    if (comfort.overallCategory === 'III') return 'warn';
    return 'fail';
}

function _getBalanceStatus(state) {
    if (!state.outlets || state.outlets.size === 0) return 'fail';
    let supplyTotal = 0, exhaustTotal = 0;
    state.outlets.forEach(outlet => {
        if (outlet.outletCategory === 'exhaust') exhaustTotal += outlet.volumeFlow;
        else supplyTotal += outlet.volumeFlow;
    });
    if (exhaustTotal === 0) return 'warn'; // No exhaust placed
    const avg = (supplyTotal + exhaustTotal) / 2;
    const diffPct = avg > 0 ? Math.abs(supplyTotal - exhaustTotal) / avg * 100 : 0;
    if (diffPct <= 5) return 'pass';
    if (diffPct <= 10) return 'warn';
    return 'fail';
}

function _buildProjectName(state) {
    if (state.room) {
        return `${state.room.length}×${state.room.width}×${state.room.height} m`;
    }
    return 'HVAC Project';
}

function _materialName(surface, t) {
    if (!surface || !surface.material) return '—';
    const mat = SURFACE_MATERIALS[surface.material];
    if (mat) return getLang() === 'de' ? mat.nameDE : mat.nameEN;
    return surface.material;
}

// ================================================================
//  BILINGUAL STRINGS
// ================================================================

function _getStrings(lang) {
    if (lang === 'en') {
        return {
            title: 'HVAC Airflow & Sound Analysis',
            roomOverview: 'Room Overview',
            roomDimensions: 'Room Dimensions',
            length: 'Length', width: 'Width', height: 'Height',
            area: 'Floor Area', volume: 'Volume',
            roomType: 'Room Type', temperature: 'Temperature',
            soundLimit: 'Sound Limit',
            surfaces: 'Surface Materials',
            ceiling: 'Ceiling', floor: 'Floor', walls: 'Walls',
            outletOverview: 'Outlet Overview',
            outletTable: 'Outlets & Calculated Results',
            nr: '#', type: 'Type', size: 'Size', dir: 'Dir.',
            airflowAnalysis: 'Airflow Analysis',
            velocityEval: 'Velocity Evaluation',
            maxVOccupied: 'Max velocity in occupied zone',
            velocityCategory: 'Velocity category',
            draughtRate: 'Draught rate (DR)',
            draughtRateOk: 'DR compliant (< 15%)',
            soundAnalysis: 'Sound Analysis',
            soundEval: 'Sound Evaluation',
            totalSound: 'Total sound level',
            soundMargin: 'Margin to limit',
            soundCompliant: 'Compliant',
            outletSoundLevels: 'Sound Levels per Outlet',
            summary: 'Summary',
            airflow: 'Airflow',
            sound: 'Sound',
            comfort: 'Comfort',
            recommendations: 'Recommendations',
            pass: '✓ PASS', warn: '⚠ WARNING', fail: '✗ FAIL',
            noData: 'No calculation data available.',
            generated: 'Report generated:'
        };
    }
    return {
        title: 'Lüftungsauslegung — Analyse',
        roomOverview: 'Raumübersicht',
        roomDimensions: 'Raumabmessungen',
        length: 'Länge', width: 'Breite', height: 'Höhe',
        area: 'Grundfläche', volume: 'Volumen',
        roomType: 'Raumtyp', temperature: 'Temperatur',
        soundLimit: 'Schallgrenze',
        surfaces: 'Oberflächenmaterialien',
        ceiling: 'Decke', floor: 'Boden', walls: 'Wände',
        outletOverview: 'Auslass-Übersicht',
        outletTable: 'Auslässe & Berechnungsergebnisse',
        nr: 'Nr.', type: 'Typ', size: 'Größe', dir: 'Richt.',
        airflowAnalysis: 'Strömungsanalyse',
        velocityEval: 'Geschwindigkeitsbewertung',
        maxVOccupied: 'Max. Geschw. Aufenthaltszone',
        velocityCategory: 'Geschwindigkeitskategorie',
        draughtRate: 'Zugluftrate (DR)',
        draughtRateOk: 'DR konform (< 15%)',
        soundAnalysis: 'Schallanalyse',
        soundEval: 'Schallbewertung',
        totalSound: 'Gesamtschallpegel',
        soundMargin: 'Reserve zum Grenzwert',
        soundCompliant: 'Konform',
        outletSoundLevels: 'Schallpegel je Auslass',
        summary: 'Zusammenfassung',
        airflow: 'Strömung',
        sound: 'Schall',
        comfort: 'Komfort',
        recommendations: 'Empfehlungen',
        pass: '✓ OK', warn: '⚠ WARNUNG', fail: '✗ NICHT KONFORM',
        noData: 'Keine Berechnungsdaten vorhanden.',
        generated: 'Bericht erstellt:'
    };
}
