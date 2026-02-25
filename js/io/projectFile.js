// ============================================================
// projectFile.js — Save/Load .hvac project files (JSON)
// ============================================================

const PROJECT_VERSION = '2.0';
const AUTOSAVE_KEY = 'hvac_simulator_autosave';
const AUTOSAVE_INTERVAL = 60000; // 60 seconds

let autoSaveTimer = null;
let getStateCallback = null;
let loadStateCallback = null;

/**
 * Initialize the project file system
 * @param {Function} getState - Returns current app state for saving
 * @param {Function} loadState - Loads state from a project object
 */
export function initProjectFile(getState, loadState) {
    getStateCallback = getState;
    loadStateCallback = loadState;

    // Set up file drop zone
    _setupFileDrop();

    // Start auto-save
    _startAutoSave();

    // Check for auto-saved project
    _checkAutoSave();
}

/**
 * Save current project as .hvac file (download)
 */
export function saveProject(filename) {
    if (!getStateCallback) return;

    const state = getStateCallback();
    const project = _stateToProject(state);
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const name = filename || _generateFilename(state);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Load project from file input
 */
export function loadProjectFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const project = JSON.parse(e.target.result);
                const validated = _validateProject(project);
                if (validated.valid) {
                    if (loadStateCallback) {
                        loadStateCallback(project);
                    }
                    resolve(project);
                } else {
                    reject(new Error(validated.error));
                }
            } catch (err) {
                reject(new Error('Datei konnte nicht gelesen werden: ' + err.message));
            }
        };
        reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
        reader.readAsText(file);
    });
}

/**
 * Trigger file open dialog
 */
export function openFileDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.hvac,.json';
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            loadProjectFromFile(file).catch(err => {
                alert(err.message);
            });
        }
    });
    input.click();
}

// ---- Internal: State <-> Project Conversion ----

function _stateToProject(state) {
    const outlets = [];
    state.outlets.forEach((outlet, id) => {
        outlets.push({
            id,
            type: outlet.typeKey,
            sizeIndex: outlet.sizeIndex,
            sizeName: outlet.sizeData?.name || '',
            outletCategory: outlet.outletCategory || 'supply',
            position: {
                x: outlet.position3D.x,
                y: outlet.position3D.y,
                z: outlet.position3D.z
            },
            rotation: outlet.rotation || 0,
            mounting: outlet.mounting || 'ceiling',
            params: {
                volumeFlow: outlet.volumeFlow,
                supplyTemp: outlet.supplyTemp,
                slotLength: outlet.slotLength || null,
                slotDirection: outlet.slotDirection || null
            }
        });
    });

    // Collect results
    const results = {};
    state.results.forEach((result, id) => {
        results[id] = {
            exitVelocity: result.exitVelocity,
            throwDistance: result.throwDistance,
            pressureDrop: result.pressureDrop,
            soundPowerLevel: result.soundPowerLevel,
            maxVelocityOccupied: result.maxVelocityOccupied,
            soundPressureAt3m: result.soundPressureAt3m
        };
    });

    return {
        version: PROJECT_VERSION,
        meta: {
            name: state.projectName || '',
            created: state.created || new Date().toISOString(),
            modified: new Date().toISOString(),
            author: '',
            description: ''
        },
        room: state.room ? {
            length: state.room.length,
            width: state.room.width,
            height: state.room.height,
            temperature: state.room.temperature,
            roomType: state.room.roomType,
            surfaces: state.room.surfaces || null
        } : null,
        outlets,
        results,
        view: state.cameraState || null,
        settings: {
            gridSnap: state.gridSnap,
            language: state.language,
            showCones: state.showCones,
            showParticles: state.showParticles,
            showSoundHeatmap: state.showSoundHeatmap,
            showVelocityZones: state.showVelocityZones,
            sliceHeight: state.sliceHeight
        }
    };
}

function _validateProject(project) {
    if (!project || typeof project !== 'object') {
        return { valid: false, error: 'Ungültiges Dateiformat' };
    }
    if (!project.version) {
        return { valid: false, error: 'Fehlende Versionsangabe' };
    }
    if (!project.room) {
        return { valid: false, error: 'Keine Raumdaten gefunden' };
    }
    if (!project.room.length || !project.room.width || !project.room.height) {
        return { valid: false, error: 'Ungültige Raumabmessungen' };
    }
    return { valid: true };
}

function _generateFilename(state) {
    const room = state.room;
    if (room) {
        return `raum_${room.length}x${room.width}x${room.height}.hvac`;
    }
    return 'projekt.hvac';
}

// ---- Auto-Save ----

function _startAutoSave() {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    autoSaveTimer = setInterval(() => {
        if (!getStateCallback) return;
        try {
            const state = getStateCallback();
            if (!state.room) return; // Nothing to save
            const project = _stateToProject(state);
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
        } catch (e) {
            // Silently fail on auto-save errors
        }
    }, AUTOSAVE_INTERVAL);
}

function _checkAutoSave() {
    try {
        const saved = localStorage.getItem(AUTOSAVE_KEY);
        if (saved) {
            const project = JSON.parse(saved);
            if (project.room && project.meta && project.meta.modified) {
                // Could show a recovery dialog, for now just store it
                window._hvacAutoSave = project;
            }
        }
    } catch (e) {
        // Ignore
    }
}

/**
 * Clear auto-save data
 */
export function clearAutoSave() {
    localStorage.removeItem(AUTOSAVE_KEY);
}

/**
 * Get auto-saved project if available
 */
export function getAutoSave() {
    return window._hvacAutoSave || null;
}

// ---- File Drop ----

function _setupFileDrop() {
    const viewport = document.getElementById('viewport');
    if (!viewport) return;

    // Prevent default drag behavior on the whole document
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    // Actual drop zone
    viewport.addEventListener('dragover', (e) => {
        e.preventDefault();
        viewport.style.outline = '2px dashed var(--accent-bright)';
        viewport.style.outlineOffset = '-4px';
    });

    viewport.addEventListener('dragleave', () => {
        viewport.style.outline = '';
        viewport.style.outlineOffset = '';
    });

    viewport.addEventListener('drop', (e) => {
        e.preventDefault();
        viewport.style.outline = '';
        viewport.style.outlineOffset = '';

        const file = e.dataTransfer?.files[0];
        if (file && (file.name.endsWith('.hvac') || file.name.endsWith('.json'))) {
            loadProjectFromFile(file).catch(err => {
                alert(err.message);
            });
        }
    });
}
