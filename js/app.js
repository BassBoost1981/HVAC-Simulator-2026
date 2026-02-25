// ============================================================
// app.js — Main entry point and application orchestrator
// HVAC Airflow & Sound Simulator — Phase 1 + 2
// ============================================================

import * as THREE from 'three';
import sceneManager from './scene/sceneManager.js';
import roomBuilder from './scene/roomBuilder.js';
import outletPlacer from './scene/outletPlacer.js';
import visualization from './scene/visualization.js';
import { calculateOutlet } from './simulation/jetPhysics.js';
import { generateSoundHeatmap, generateVelocityHeatmap } from './simulation/acoustics.js';
import { getType, DIFFUSER_TYPES, EXHAUST_TYPES } from './simulation/diffuserDB.js';
import { evaluateComfort } from './simulation/comfort.js';
import sidebar from './ui/sidebar.js';
import propertiesPanel from './ui/properties.js';
import toolbar from './ui/toolbar.js';
import roomModal from './ui/roomModal.js';
import { initI18n, setLanguage, t, onLanguageChange } from './ui/i18n.js';
import { initProjectFile, saveProject, openFileDialog } from './io/projectFile.js';
import { exportPDF } from './io/pdfExport.js';

// ---- Application State ----
const state = {
    room: null,
    outlets: new Map(),
    results: new Map(),
    selectedOutletId: null,
    gridSnap: 0.25,
    language: 'de',
    showCones: true,
    showParticles: false,
    showSoundHeatmap: false,
    showVelocityZones: false,
    sliceHeight: 1.2,
    projectName: '',
    comfortResult: null,
    balance: null
};

// ---- Initialization ----
async function init() {
    await initI18n('de');

    // Three.js
    sceneManager.init();

    // Visualization (must init after sceneManager for frame updates)
    visualization.init();

    // Sidebar
    sidebar.init((typeKey, sizeIndex, outletCategory) => {
        if (!state.room) return;
        outletPlacer.startPlacement(typeKey, sizeIndex, outletCategory);
    });

    // Outlet placer (with Phase 2 drag/rotate callbacks)
    outletPlacer.init({
        onPlaced: handleOutletPlaced,
        onSelected: handleOutletSelected,
        onDeselected: handleOutletDeselected,
        onMoved: handleOutletMoved,
        onRotated: handleOutletRotated
    });

    // Properties panel
    propertiesPanel.init(handleParamChanged, handleOutletDelete);

    // Toolbar
    toolbar.init({
        onViewChange: handleViewChange,
        onGridChange: handleGridChange,
        onVisToggle: handleVisToggle,
        onNewRoom: () => roomModal.showNewRoom()
    });

    // Room modal (third arg = open project from welcome screen)
    roomModal.init(handleCreateRoom, handleLoadExample, () => openFileDialog());

    // Language toggle
    document.getElementById('lang-de')?.addEventListener('click', () => switchLanguage('de'));
    document.getElementById('lang-en')?.addEventListener('click', () => switchLanguage('en'));

    // Save/Load/PDF
    initProjectFile(getStateForSave, loadStateFromProject);
    document.getElementById('btn-save')?.addEventListener('click', () => saveProject());
    document.getElementById('btn-load')?.addEventListener('click', () => openFileDialog());

    const btnPdf = document.getElementById('btn-pdf');
    if (btnPdf) {
        btnPdf.title = t('status.pdf.title');
        btnPdf.addEventListener('click', () => {
            if (!state.room) return;
            _updateComfort();
            exportPDF(state, state.comfortResult);
        });
    }

    // Enable Phase 2 buttons
    _enablePhase2Buttons();

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);

    // Show welcome screen
    roomModal.showWelcome();
}

function _enablePhase2Buttons() {
    // Particle toggle
    const btnParticles = document.getElementById('btn-vis-particles');
    if (btnParticles) {
        btnParticles.addEventListener('click', () => {
            state.showParticles = !state.showParticles;
            btnParticles.classList.toggle('active', state.showParticles);
            handleVisToggle('particles', state.showParticles);
        });
    }

    // Velocity zones toggle
    const btnZones = document.getElementById('btn-vis-zones');
    if (btnZones) {
        btnZones.addEventListener('click', () => {
            state.showVelocityZones = !state.showVelocityZones;
            btnZones.classList.toggle('active', state.showVelocityZones);
            handleVisToggle('zones', state.showVelocityZones);
        });
    }

    // Sound heatmap toggle
    const btnSound = document.getElementById('btn-vis-sound');
    if (btnSound) {
        btnSound.addEventListener('click', () => {
            state.showSoundHeatmap = !state.showSoundHeatmap;
            btnSound.classList.toggle('active', state.showSoundHeatmap);
            handleVisToggle('sound', state.showSoundHeatmap);
        });
    }

    // Height slider for heatmap cut plane
    const slider = document.getElementById('slice-height-slider');
    const sliderVal = document.getElementById('slice-height-value');
    if (slider) {
        slider.addEventListener('input', (e) => {
            const h = parseFloat(e.target.value);
            state.sliceHeight = h;
            visualization.setSliceHeight(h);
            if (sliderVal) sliderVal.textContent = h.toFixed(1) + ' m';
            if (state.showSoundHeatmap || state.showVelocityZones) {
                _scheduleHeatmapUpdate();
            }
        });
    }
}

// ================================================================
//  ROOM HANDLING
// ================================================================

function handleCreateRoom({ length, width, height, roomType, temperature, surfaces }) {
    // Clear existing
    state.outlets.clear();
    state.results.clear();
    state.selectedOutletId = null;
    outletPlacer.cancelPlacement();
    visualization.clearAll();
    sceneManager.clearGroup(sceneManager.outletsGroup);
    sceneManager.clearGroup(sceneManager.helperGroup);

    state.room = { length, width, height, roomType, temperature, surfaces: surfaces || null };
    state.balance = null;
    roomBuilder.buildRoom(length, width, height);
    propertiesPanel.showRoom(state.room);
    toolbar.updateStatus(0, null);
    toolbar.updateBalance(null);

    // Update slice height slider to match room height
    const slider = document.getElementById('slice-height-slider');
    if (slider) {
        slider.max = height;
        if (state.sliceHeight > height) {
            state.sliceHeight = Math.min(1.2, height * 0.4);
            slider.value = state.sliceHeight;
            const sliderVal = document.getElementById('slice-height-value');
            if (sliderVal) sliderVal.textContent = state.sliceHeight.toFixed(1) + ' m';
        }
    }

    const projName = document.getElementById('project-name');
    if (projName) {
        projName.textContent = `${length}×${width}×${height} m — ${getRoomTypeName(roomType)}`;
    }
}

function handleLoadExample() {
    handleCreateRoom({
        length: 8, width: 6, height: 3.2,
        roomType: 'meeting_room', temperature: 22
    });

    setTimeout(() => {
        const typeData = getType('swirl');
        const sizeData = typeData.sizes[2];

        const o1 = createOutletData('swirl', 2, sizeData, typeData,
            new THREE.Vector3(-1.5, 3.2, 0), 500);
        addOutlet(o1);

        const o2 = createOutletData('swirl', 2, sizeData, typeData,
            new THREE.Vector3(1.5, 3.2, 0), 500);
        addOutlet(o2);
    }, 100);
}

// ================================================================
//  OUTLET HANDLING
// ================================================================

function handleOutletPlaced(outletData) {
    addOutlet(outletData);
}

function addOutlet(outletData) {
    state.outlets.set(outletData.id, outletData);

    if (!outletPlacer.outlets.has(outletData.id)) {
        outletPlacer.placeOutlet(
            outletData.typeKey, outletData.sizeIndex,
            outletData.position3D, outletData.id,
            outletData.outletCategory
        );
    }

    recalculate(outletData.id);
    selectOutlet(outletData.id);
    toolbar.updateStatus(state.outlets.size, null);
}

function createOutletData(typeKey, sizeIndex, sizeData, typeData, position3D, volumeFlow, outletCategory) {
    const isExhaust = outletCategory === 'exhaust' || !!EXHAUST_TYPES[typeKey];
    return {
        id: 'outlet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        typeKey, sizeIndex, sizeData, typeData,
        position3D: position3D.clone(),
        mounting: 'ceiling',
        volumeFlow: volumeFlow || sizeData.vFlowDefault,
        supplyTemp: isExhaust ? null : 18,
        rotation: 0,
        slotLength: sizeData.lengthDefault || null,
        slotDirection: typeKey === 'slot' ? 'bidirectional' : null,
        outletCategory: isExhaust ? 'exhaust' : 'supply'
    };
}

function handleOutletSelected(outletId) {
    selectOutlet(outletId);
}

function handleOutletDeselected() {
    state.selectedOutletId = null;
    if (state.room) propertiesPanel.showRoom(state.room);
    else propertiesPanel.showEmpty();
}

function selectOutlet(outletId) {
    state.selectedOutletId = outletId;
    outletPlacer.selectOutlet(outletId);
    const outlet = state.outlets.get(outletId);
    const results = state.results.get(outletId);
    if (outlet && state.room) {
        propertiesPanel.showOutlet(outlet, state.room, results || null, state.comfortResult);
    }
}

function handleOutletDelete(outletId) {
    state.outlets.delete(outletId);
    state.results.delete(outletId);
    outletPlacer.removeOutlet(outletId);
    visualization.removeCone(outletId);
    visualization.removeParticleSystem(outletId);

    state.selectedOutletId = null;
    if (state.room) propertiesPanel.showRoom(state.room);
    else propertiesPanel.showEmpty();

    toolbar.updateStatus(state.outlets.size, null);
    _updateComfort();
    _updateBalance();
    updateHeatmaps();
}

// ---- Phase 2: Drag & Rotate handlers ----

function handleOutletMoved(outletId, newX, newZ) {
    const outlet = state.outlets.get(outletId);
    if (!outlet) return;
    outlet.position3D.x = newX;
    outlet.position3D.z = newZ;
    recalculate(outletId);
}

function handleOutletRotated(outletId, newRotation) {
    const outlet = state.outlets.get(outletId);
    if (!outlet) return;
    outlet.rotation = newRotation;
    recalculate(outletId);
}

// ================================================================
//  CALCULATION
// ================================================================

function handleParamChanged(outletId) {
    recalculate(outletId);
    const outlet = state.outlets.get(outletId);
    if (outlet) {
        outletPlacer.updateOutletPosition(outletId, outlet.position3D);
    }
}

function recalculate(outletId) {
    const outlet = state.outlets.get(outletId);
    if (!outlet || !state.room) return;

    const t0 = performance.now();

    const result = calculateOutlet({
        typeKey: outlet.typeKey,
        sizeData: outlet.sizeData,
        volumeFlow: outlet.volumeFlow,
        supplyTemp: outlet.supplyTemp ?? state.room.temperature,
        mounting: outlet.mounting,
        slotLength: outlet.slotLength,
        slotDirection: outlet.slotDirection,
        outletCategory: outlet.outletCategory || 'supply'
    }, {
        height: state.room.height,
        temperature: state.room.temperature
    });

    const calcTime = performance.now() - t0;
    state.results.set(outletId, result);

    // Update visualizations
    visualization.updateCone(outlet, result, state.room);

    // Update slot direction indicator on the 3D mesh
    if (outlet.typeKey === 'slot') {
        outletPlacer.updateSlotDirectionIndicator(outletId, outlet.slotDirection);
    }

    if (state.showParticles) {
        visualization.createParticleSystem(outlet, result, state.room);
    }

    // Run comfort evaluation across all outlets
    _updateComfort();
    _updateBalance();

    if (state.selectedOutletId === outletId) {
        propertiesPanel.showOutlet(outlet, state.room, result, state.comfortResult);
    }

    toolbar.updateStatus(state.outlets.size, calcTime);

    // Debounced heatmap update
    _scheduleHeatmapUpdate();
}

function _updateComfort() {
    if (!state.room || state.outlets.size === 0) {
        state.comfortResult = null;
        return;
    }
    const outletsForComfort = [];
    state.outlets.forEach((outlet, id) => {
        const jetResult = state.results.get(id);
        if (jetResult) outletsForComfort.push({ outlet, jetResult });
    });
    state.comfortResult = evaluateComfort(outletsForComfort, state.room);
}

function _updateBalance() {
    if (!state.room || state.outlets.size === 0) {
        state.balance = null;
        toolbar.updateBalance(null);
        return;
    }
    let supplyTotal = 0;
    let exhaustTotal = 0;
    state.outlets.forEach((outlet) => {
        if (outlet.outletCategory === 'exhaust') {
            exhaustTotal += outlet.volumeFlow;
        } else {
            supplyTotal += outlet.volumeFlow;
        }
    });
    const avg = (supplyTotal + exhaustTotal) / 2;
    const diffPercent = avg > 0 ? Math.abs(supplyTotal - exhaustTotal) / avg * 100 : 0;
    state.balance = { supplyTotal, exhaustTotal, diffPercent };
    toolbar.updateBalance(state.balance);
}

let _heatmapTimer = null;
function _scheduleHeatmapUpdate() {
    if (_heatmapTimer) clearTimeout(_heatmapTimer);
    _heatmapTimer = setTimeout(updateHeatmaps, 200);
}

function updateHeatmaps() {
    if (!state.room || state.outlets.size === 0) {
        visualization.removeSoundHeatmap();
        visualization.removeVelocityHeatmap();
        return;
    }

    // Prepare outlet data for heatmap generation
    const outletsForCalc = [];
    state.outlets.forEach((outlet, id) => {
        const result = state.results.get(id);
        if (result) {
            outletsForCalc.push({
                position3D: outlet.position3D,
                mounting: outlet.mounting,
                soundPowerLevel: result.soundPowerLevel,
                jetResult: result
            });
        }
    });

    if (outletsForCalc.length === 0) return;

    // Sound heatmap
    if (state.showSoundHeatmap) {
        const soundData = generateSoundHeatmap(outletsForCalc, state.room, 0.5, state.sliceHeight);
        visualization.updateSoundHeatmap(soundData);
    }

    // Velocity zones
    if (state.showVelocityZones) {
        const velData = generateVelocityHeatmap(outletsForCalc, state.room, 0.5, state.sliceHeight);
        visualization.updateVelocityHeatmap(velData);
    }
}

// ================================================================
//  CAMERA & TOOLBAR
// ================================================================

function handleViewChange(view) {
    if (!state.room) return;
    const { length, width, height } = state.room;
    switch (view) {
        case 'perspective': sceneManager.setPerspective(length, width, height); break;
        case 'top': sceneManager.setTopDown(length, width, height); break;
        case 'front': sceneManager.setFront(length, width, height); break;
        case 'side': sceneManager.setSide(length, width, height); break;
    }
}

function handleGridChange(value) {
    state.gridSnap = value;
    outletPlacer.setGridSnap(value);
}

function handleVisToggle(type, visible) {
    switch (type) {
        case 'cone':
            state.showCones = visible;
            visualization.setConesVisible(visible);
            break;
        case 'particles':
            state.showParticles = visible;
            visualization.setParticlesVisible(visible);
            if (visible) {
                // Create particle systems for all outlets
                state.outlets.forEach((outlet, id) => {
                    const result = state.results.get(id);
                    if (result) {
                        visualization.createParticleSystem(outlet, result, state.room);
                    }
                });
            }
            break;
        case 'zones':
            state.showVelocityZones = visible;
            visualization.setVelocityZonesVisible(visible);
            if (visible) updateHeatmaps();
            break;
        case 'sound':
            state.showSoundHeatmap = visible;
            visualization.setSoundHeatmapVisible(visible);
            if (visible) updateHeatmaps();
            break;
    }
}

// ================================================================
//  LANGUAGE
// ================================================================

async function switchLanguage(lang) {
    state.language = lang;
    await setLanguage(lang);
    document.getElementById('lang-de')?.classList.toggle('active', lang === 'de');
    document.getElementById('lang-en')?.classList.toggle('active', lang === 'en');

    // Re-render dynamic content with new language
    if (state.room) {
        const projName = document.getElementById('project-name');
        if (projName) {
            projName.textContent = `${state.room.length}×${state.room.width}×${state.room.height} m — ${getRoomTypeName(state.room.roomType)}`;
        }
        if (state.selectedOutletId) {
            const outlet = state.outlets.get(state.selectedOutletId);
            const results = state.results.get(state.selectedOutletId);
            if (outlet) propertiesPanel.showOutlet(outlet, state.room, results || null, state.comfortResult);
        } else {
            propertiesPanel.showRoom(state.room);
        }
    }

    // Re-populate room type select in modal
    _updateRoomTypeSelect();
}

function _updateRoomTypeSelect() {
    const sel = document.getElementById('room-type');
    if (!sel) return;
    const types = ['office', 'open_office', 'meeting_room', 'classroom', 'hospital', 'restaurant', 'auditorium'];
    const dbAs = { office: 35, open_office: 40, meeting_room: '30\u201335', classroom: 35, hospital: 30, restaurant: 45, auditorium: 30 };
    const current = sel.value;
    sel.innerHTML = types.map(key =>
        `<option value="${key}" ${key === current ? 'selected' : ''}>${t('room.type.' + key)} (${dbAs[key]} dB(A))</option>`
    ).join('');
}

// ================================================================
//  KEYBOARD
// ================================================================

function handleKeyboard(event) {
    if ((event.key === 'Delete' || event.key === 'Backspace') && state.selectedOutletId) {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;
        handleOutletDelete(state.selectedOutletId);
    }

    if (event.key === 'Escape') {
        if (state.selectedOutletId) handleOutletDeselected();
        sidebar.clearSelection();
    }

    if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;

    // Camera presets
    if (event.key === '1') handleViewChange('perspective');
    if (event.key === '2') handleViewChange('top');
    if (event.key === '3') handleViewChange('front');
    if (event.key === '4') handleViewChange('side');

    // Quick toggles
    if (event.key === 'p' || event.key === 'P') {
        state.showParticles = !state.showParticles;
        document.getElementById('btn-vis-particles')?.classList.toggle('active', state.showParticles);
        handleVisToggle('particles', state.showParticles);
    }
    if (event.key === 'c' || event.key === 'C') {
        state.showCones = !state.showCones;
        document.getElementById('btn-vis-cone')?.classList.toggle('active', state.showCones);
        handleVisToggle('cone', state.showCones);
    }

    // Save shortcut
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        saveProject();
    }
}

// ================================================================
//  SAVE / LOAD
// ================================================================

function getStateForSave() {
    return {
        room: state.room,
        outlets: state.outlets,
        results: state.results,
        gridSnap: state.gridSnap,
        language: state.language,
        showCones: state.showCones,
        showParticles: state.showParticles,
        showSoundHeatmap: state.showSoundHeatmap,
        showVelocityZones: state.showVelocityZones,
        sliceHeight: state.sliceHeight,
        projectName: state.projectName,
        cameraState: {
            position: {
                x: sceneManager.camera.position.x,
                y: sceneManager.camera.position.y,
                z: sceneManager.camera.position.z
            },
            target: {
                x: sceneManager.controls.target.x,
                y: sceneManager.controls.target.y,
                z: sceneManager.controls.target.z
            }
        }
    };
}

function loadStateFromProject(project) {
    if (!project.room) return;

    // Create room
    handleCreateRoom({
        length: project.room.length,
        width: project.room.width,
        height: project.room.height,
        roomType: project.room.roomType || 'meeting_room',
        temperature: project.room.temperature || 22,
        surfaces: project.room.surfaces || null
    });

    // Restore outlets
    if (project.outlets && project.outlets.length > 0) {
        setTimeout(() => {
            for (const o of project.outlets) {
                const typeData = getType(o.type);
                if (!typeData) continue;
                const sizeData = typeData.sizes[o.sizeIndex || 0];
                if (!sizeData) continue;

                const outletData = createOutletData(
                    o.type,
                    o.sizeIndex || 0,
                    sizeData,
                    typeData,
                    new THREE.Vector3(o.position.x, o.position.y, o.position.z),
                    o.params?.volumeFlow || sizeData.vFlowDefault,
                    o.outletCategory || 'supply'
                );
                outletData.id = o.id || outletData.id;
                outletData.supplyTemp = o.outletCategory === 'exhaust' ? null : (o.params?.supplyTemp || 18);
                outletData.rotation = o.rotation || 0;
                outletData.slotLength = o.params?.slotLength || null;
                outletData.slotDirection = o.params?.slotDirection || (o.type === 'slot' ? 'bidirectional' : null);
                outletData.mounting = o.mounting || 'ceiling';
                outletData.outletCategory = o.outletCategory || 'supply';

                addOutlet(outletData);
            }

            // Restore camera
            if (project.view) {
                sceneManager.camera.position.set(
                    project.view.position.x,
                    project.view.position.y,
                    project.view.position.z
                );
                sceneManager.controls.target.set(
                    project.view.target.x,
                    project.view.target.y,
                    project.view.target.z
                );
                sceneManager.controls.update();
            }

            // Restore settings
            if (project.settings) {
                state.gridSnap = project.settings.gridSnap || 0.25;
                state.sliceHeight = project.settings.sliceHeight || 1.2;
            }

            // Deselect after loading
            handleOutletDeselected();
        }, 150);
    }
}

// ================================================================
//  HELPERS
// ================================================================

function getRoomTypeName(key) {
    return t('room.type.' + key);
}

// ---- Start ----
init().catch(err => {
    console.error('[HVAC Simulator] Initialization failed:', err);
});
