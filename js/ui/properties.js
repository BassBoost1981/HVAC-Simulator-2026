// ============================================================
// properties — Right-side parameter panel with live results
// ============================================================

import { DIFFUSER_TYPES, EXHAUST_TYPES, ROOM_TYPES, SLOT_DIRECTIONS, getType, getSize } from '../simulation/diffuserDB.js';
import { OBSTACLE_PRESETS } from '../scene/obstacleManager.js';
import { t, onLanguageChange } from './i18n.js';

class PropertiesPanel {
    constructor() {
        this.container = document.getElementById('props-content');
        this.emptyState = document.getElementById('props-empty');
        this.onParamChange = null;
        this.onOutletDelete = null;
        this.onBeforeParamChange = null;
        this.onObstacleParamChange = null;
        this.onObstacleDelete = null;
        this.currentOutlet = null;
        this.currentObstacle = null;
        this.currentRoom = null;
        this.currentResults = null;
    }

    init(onParamChange, onOutletDelete, onBeforeParamChange, onObstacleParamChange, onObstacleDelete) {
        this.onParamChange = onParamChange;
        this.onOutletDelete = onOutletDelete;
        this.onBeforeParamChange = onBeforeParamChange || null;
        this.onObstacleParamChange = onObstacleParamChange || null;
        this.onObstacleDelete = onObstacleDelete || null;
    }

    /**
     * Show room info (when no outlet selected)
     */
    showRoom(room) {
        this.currentRoom = room;
        this.currentOutlet = null;

        const area = (room.length * room.width).toFixed(1);
        const volume = (room.length * room.width * room.height).toFixed(1);
        const roomType = ROOM_TYPES[room.roomType];

        this.container.innerHTML = `
            <div class="props-section">
                <div class="props-section-title">${t('props.room.title')}</div>
                <div class="result-row">
                    <span class="result-label">${t('props.room.dimensions')}</span>
                    <span class="result-value">${room.length} × ${room.width} × ${room.height}</span>
                    <span class="result-unit">m</span>
                </div>
                <div class="result-row">
                    <span class="result-label">${t('props.room.area')}</span>
                    <span class="result-value">${area}</span>
                    <span class="result-unit">m²</span>
                </div>
                <div class="result-row">
                    <span class="result-label">${t('props.room.volume')}</span>
                    <span class="result-value">${volume}</span>
                    <span class="result-unit">m³</span>
                </div>
                <div class="result-row">
                    <span class="result-label">${t('props.room.type')}</span>
                    <span class="result-value">${roomType ? t('room.type.' + room.roomType) : room.roomType}</span>
                    <span class="result-unit"></span>
                </div>
                <div class="result-row">
                    <span class="result-label">${t('props.room.temp')}</span>
                    <span class="result-value">${room.temperature}</span>
                    <span class="result-unit">°C</span>
                </div>
                <div class="result-row">
                    <span class="result-label">${t('props.room.soundLimit')}</span>
                    <span class="result-value">${roomType ? roomType.maxDbA : '—'}</span>
                    <span class="result-unit">dB(A)</span>
                </div>
            </div>
        `;

        if (this.emptyState) this.emptyState.style.display = 'none';
    }

    /**
     * Show outlet parameters and results
     */
    showOutlet(outlet, room, results, comfortResult) {
        this.currentOutlet = outlet;
        this.currentRoom = room;
        this.currentResults = results;

        if (this.emptyState) this.emptyState.style.display = 'none';

        const typeData = getType(outlet.typeKey);
        const roomType = ROOM_TYPES[room.roomType];
        const maxDbA = roomType ? roomType.maxDbA : 35;
        const isExhaust = outlet.outletCategory === 'exhaust';

        // Build size options
        const sizeOptions = typeData.sizes.map((s, i) =>
            `<option value="${i}" ${i === outlet.sizeIndex ? 'selected' : ''}>${s.name}</option>`
        ).join('');

        // Build type options — from EXHAUST_TYPES or DIFFUSER_TYPES based on category
        const typeCatalog = isExhaust ? EXHAUST_TYPES : DIFFUSER_TYPES;
        const typeOptions = Object.entries(typeCatalog).map(([key, data]) =>
            `<option value="${key}" ${key === outlet.typeKey ? 'selected' : ''}>${t('diffuser.' + key)}</option>`
        ).join('');

        // Slot-specific fields (only for supply slot)
        let slotField = '';
        if (outlet.typeKey === 'slot') {
            const dirOptions = Object.entries(SLOT_DIRECTIONS).map(([key, data]) =>
                `<option value="${key}" ${key === (outlet.slotDirection || 'bidirectional') ? 'selected' : ''}>${t('slotDirection.' + key)}</option>`
            ).join('');
            slotField = `
            <div class="form-group">
                <label>${t('props.outlet.slotLength')}</label>
                <div class="input-row">
                    <input type="number" id="prop-slot-length" min="300" max="3000" step="50"
                           value="${outlet.slotLength || outlet.sizeData.lengthDefault}">
                    <span class="input-unit">mm</span>
                </div>
            </div>
            <div class="form-group">
                <label>${t('props.outlet.slotDirection')}</label>
                <select id="prop-slot-direction">${dirOptions}</select>
            </div>
            `;
        }

        // Supply temperature field (only for supply outlets)
        const supplyTempField = isExhaust ? '' : `
                <div class="form-group">
                    <label>${t('props.outlet.supplyTemp')}</label>
                    <div class="input-row">
                        <input type="number" id="prop-supply-temp" min="10" max="40" step="0.5" value="${outlet.supplyTemp}">
                        <span class="input-unit">°C</span>
                    </div>
                </div>`;

        // Traffic light helpers
        const vlColor = isExhaust ? '' : this._trafficLight(results?.maxVelocityOccupied, 0.15, 0.20, 0.25);
        const soundColor = this._soundTrafficLight(results?.soundPowerLevel, maxDbA);
        const sound3mColor = this._soundTrafficLight(results?.soundPressureAt3m, maxDbA);
        const v0Color = results?.exitVelocity > 5 ? 'red' : results?.exitVelocity > 3 ? 'yellow' : 'green';

        // Labels differ for exhaust
        const throwLabel = isExhaust ? t('props.results.suctionReach') : t('props.results.throwDistance');
        const sectionTitle = isExhaust ? t('props.outlet.exhaustTitle') : t('props.outlet.supplyTitle');
        const maxVLabel = t('props.results.maxVelocity');
        const maxVValue = isExhaust ? '—' : (results ? results.maxVelocityOccupied.toFixed(2) : '—');

        // Exhaust note
        const exhaustNote = isExhaust ? `
                <div class="result-row" style="opacity:0.6; font-style:italic;">
                    <span class="result-label">${t('props.outlet.exhaustNote')}</span>
                </div>` : '';

        this.container.innerHTML = `
            <div class="props-section">
                <div class="props-section-title">${sectionTitle}</div>
                <div class="form-group">
                    <label>${t('props.outlet.type')}</label>
                    <select id="prop-type">${typeOptions}</select>
                </div>
                <div class="form-group">
                    <label>${t('props.outlet.size')}</label>
                    <select id="prop-size">${sizeOptions}</select>
                </div>
                <div class="form-group">
                    <label>${t('props.outlet.volumeFlow')}</label>
                    <div class="input-row">
                        <input type="number" id="prop-flow"
                               min="${outlet.sizeData.vFlowRange[0]}"
                               max="${outlet.sizeData.vFlowRange[1]}"
                               step="10"
                               value="${outlet.volumeFlow}">
                        <span class="input-unit">m³/h</span>
                    </div>
                </div>
                ${supplyTempField}
                ${slotField}
                <div class="form-group">
                    <label>${t('props.outlet.position')}</label>
                    <div class="input-row">
                        <span class="input-unit" style="min-width:14px">X</span>
                        <input type="number" id="prop-pos-x" step="0.25" value="${outlet.position3D.x.toFixed(2)}">
                        <span class="input-unit" style="min-width:14px">Z</span>
                        <input type="number" id="prop-pos-z" step="0.25" value="${outlet.position3D.z.toFixed(2)}">
                    </div>
                </div>
            </div>

            <div class="props-section">
                <div class="props-section-title">${t('props.results.title')}</div>
                ${exhaustNote}
                <div class="result-row">
                    <span class="result-label">${t('props.results.exitVelocityShort')}</span>
                    <span class="result-value">${results ? results.exitVelocity.toFixed(2) : '—'}</span>
                    <span class="result-unit">m/s</span>
                    <span class="traffic-light ${v0Color}"></span>
                </div>
                <div class="result-row">
                    <span class="result-label">${throwLabel}</span>
                    <span class="result-value">${results ? results.throwDistance.toFixed(1) : '—'}</span>
                    <span class="result-unit">m</span>
                </div>
                ${!isExhaust && results?.throwDistanceCoanda ? `
                <div class="result-row">
                    <span class="result-label" style="font-size:10px; opacity:0.6">  ${t('props.results.coanda')}</span>
                    <span class="result-value" style="font-size:11px; opacity:0.6">${results.throwDistanceCoanda.toFixed(1)}</span>
                    <span class="result-unit">m</span>
                </div>` : ''}
                ${!isExhaust && results?.detachmentPoint ? `
                <div class="result-row">
                    <span class="result-label" style="font-size:10px; opacity:0.6">  ${t('props.results.detachment')}</span>
                    <span class="result-value" style="font-size:11px; opacity:0.6">${results.detachmentPoint.toFixed(1)}</span>
                    <span class="result-unit">m</span>
                </div>` : ''}
                <div class="result-row">
                    <span class="result-label">${t('props.results.pressureDrop')}</span>
                    <span class="result-value">${results ? results.pressureDrop.toFixed(0) : '—'}</span>
                    <span class="result-unit">Pa</span>
                </div>
                <div class="result-row">
                    <span class="result-label">${t('props.results.soundPower')}</span>
                    <span class="result-value">${results ? results.soundPowerLevel.toFixed(1) : '—'}</span>
                    <span class="result-unit">dB(A)</span>
                    <span class="traffic-light ${soundColor}"></span>
                </div>
                <div class="result-row">
                    <span class="result-label">${t('props.results.soundAt3m')}</span>
                    <span class="result-value">${results ? results.soundPressureAt3m.toFixed(1) : '—'}</span>
                    <span class="result-unit">dB(A)</span>
                    <span class="traffic-light ${sound3mColor}"></span>
                </div>
                <div class="result-row">
                    <span class="result-label">${maxVLabel}</span>
                    <span class="result-value">${maxVValue}</span>
                    <span class="result-unit">${isExhaust ? '' : 'm/s'}</span>
                    ${isExhaust ? '' : `<span class="traffic-light ${vlColor}"></span>`}
                </div>
                <div class="result-row">
                    <span class="result-label">${t('props.results.effectiveArea')}</span>
                    <span class="result-value">${results ? (results.effectiveArea * 10000).toFixed(0) : '—'}</span>
                    <span class="result-unit">cm²</span>
                </div>
            </div>

            ${comfortResult ? `
            <div class="props-section">
                <div class="props-section-title">${t('props.comfort.title')}</div>
                <div class="result-row">
                    <span class="result-label">${t('props.comfort.category')}</span>
                    <span class="result-value">${comfortResult.overallCategory}</span>
                    <span class="result-unit"></span>
                    <span class="traffic-light ${comfortResult.overallCategory === 'FAIL' ? 'red' : comfortResult.overallCategory === 'III' ? 'yellow' : 'green'}"></span>
                </div>
                <div class="result-row">
                    <span class="result-label">${t('props.comfort.draughtRate')}</span>
                    <span class="result-value">${comfortResult.draughtRate.toFixed(1)}</span>
                    <span class="result-unit">%</span>
                    <span class="traffic-light ${comfortResult.draughtRate > 15 ? 'red' : comfortResult.draughtRate > 10 ? 'yellow' : 'green'}"></span>
                </div>
                <div class="result-row">
                    <span class="result-label">${t('props.comfort.totalSound')}</span>
                    <span class="result-value">${comfortResult.totalSoundLevel.toFixed(1)} / ${comfortResult.soundLimit}</span>
                    <span class="result-unit">dB(A)</span>
                    <span class="traffic-light ${comfortResult.soundCompliant ? (comfortResult.soundMargin > 5 ? 'green' : 'yellow') : 'red'}"></span>
                </div>
            </div>
            ` : ''}

            <div class="props-section" style="padding-top:8px;">
                <button class="btn-secondary" id="btn-delete-outlet" style="width:100%; color:var(--error); border-color: var(--error);">
                    ${t('props.outlet.deleteButton')}
                </button>
            </div>
        `;

        // Attach event listeners
        this._attachListeners();
    }

    _attachListeners() {
        const propType = document.getElementById('prop-type');
        const propSize = document.getElementById('prop-size');
        const propFlow = document.getElementById('prop-flow');
        const propTemp = document.getElementById('prop-supply-temp');
        const propPosX = document.getElementById('prop-pos-x');
        const propPosZ = document.getElementById('prop-pos-z');
        const propSlot = document.getElementById('prop-slot-length');
        const propSlotDir = document.getElementById('prop-slot-direction');
        const btnDelete = document.getElementById('btn-delete-outlet');

        const emitBefore = () => {
            if (this.onBeforeParamChange && this.currentOutlet) {
                this.onBeforeParamChange(this.currentOutlet.id);
            }
        };

        const emit = () => {
            if (this.onParamChange && this.currentOutlet) {
                this.onParamChange(this.currentOutlet.id);
            }
        };

        if (propType) {
            propType.addEventListener('change', (e) => {
                if (this.currentOutlet) {
                    emitBefore();
                    this.currentOutlet.typeKey = e.target.value;
                    this.currentOutlet.sizeIndex = 0;
                    const newType = getType(e.target.value);
                    this.currentOutlet.sizeData = newType.sizes[0];
                    this.currentOutlet.typeData = newType;
                    this.currentOutlet.volumeFlow = newType.sizes[0].vFlowDefault;
                    if (e.target.value === 'slot') {
                        this.currentOutlet.slotLength = newType.sizes[0].lengthDefault;
                        this.currentOutlet.slotDirection = 'bidirectional';
                    } else {
                        this.currentOutlet.slotDirection = null;
                    }
                    emit();
                }
            });
        }

        if (propSize) {
            propSize.addEventListener('change', (e) => {
                if (this.currentOutlet) {
                    emitBefore();
                    const idx = parseInt(e.target.value);
                    this.currentOutlet.sizeIndex = idx;
                    const typeData = getType(this.currentOutlet.typeKey);
                    this.currentOutlet.sizeData = typeData.sizes[idx];
                    this.currentOutlet.volumeFlow = typeData.sizes[idx].vFlowDefault;
                    emit();
                }
            });
        }

        if (propFlow) {
            propFlow.addEventListener('input', (e) => {
                if (this.currentOutlet) {
                    emitBefore();
                    this.currentOutlet.volumeFlow = parseFloat(e.target.value) || 0;
                    emit();
                }
            });
        }

        if (propTemp) {
            propTemp.addEventListener('input', (e) => {
                if (this.currentOutlet) {
                    emitBefore();
                    this.currentOutlet.supplyTemp = parseFloat(e.target.value) || 18;
                    emit();
                }
            });
        }

        if (propPosX) {
            propPosX.addEventListener('input', (e) => {
                if (this.currentOutlet) {
                    emitBefore();
                    this.currentOutlet.position3D.x = parseFloat(e.target.value) || 0;
                    emit();
                }
            });
        }

        if (propPosZ) {
            propPosZ.addEventListener('input', (e) => {
                if (this.currentOutlet) {
                    emitBefore();
                    this.currentOutlet.position3D.z = parseFloat(e.target.value) || 0;
                    emit();
                }
            });
        }

        if (propSlot) {
            propSlot.addEventListener('input', (e) => {
                if (this.currentOutlet) {
                    emitBefore();
                    this.currentOutlet.slotLength = parseFloat(e.target.value) || 1000;
                    emit();
                }
            });
        }

        if (propSlotDir) {
            propSlotDir.addEventListener('change', (e) => {
                if (this.currentOutlet) {
                    emitBefore();
                    this.currentOutlet.slotDirection = e.target.value;
                    emit();
                }
            });
        }

        if (btnDelete) {
            btnDelete.addEventListener('click', () => {
                if (this.currentOutlet && this.onOutletDelete) {
                    this.onOutletDelete(this.currentOutlet.id);
                }
            });
        }
    }

    /**
     * Show obstacle parameters
     */
    showObstacle(obstacle, room) {
        this.currentOutlet = null;
        this.currentObstacle = obstacle;
        this.currentRoom = room;
        if (this.emptyState) this.emptyState.style.display = 'none';

        const preset = OBSTACLE_PRESETS[obstacle.presetKey] || {};
        const presetName = t('obstacle.' + obstacle.presetKey);
        const isCylinder = obstacle.shape === 'cylinder';

        this.container.innerHTML = `
            <div class="props-section">
                <div class="props-section-title">${t('obstacle.title')}</div>
                <div class="result-row">
                    <span class="result-label">${t('obstacle.type')}</span>
                    <span class="result-value">${presetName}</span>
                </div>
                <div class="form-group">
                    <label>${isCylinder ? t('obstacle.diameter') : t('obstacle.width')}</label>
                    <div class="input-row">
                        <input type="number" id="prop-obs-width" min="0.1" max="10" step="0.1" value="${obstacle.width}">
                        <span class="input-unit">m</span>
                    </div>
                </div>
                ${isCylinder ? '' : `<div class="form-group">
                    <label>${t('obstacle.depth')}</label>
                    <div class="input-row">
                        <input type="number" id="prop-obs-depth" min="0.1" max="10" step="0.1" value="${obstacle.depth}">
                        <span class="input-unit">m</span>
                    </div>
                </div>`}
                <div class="form-group">
                    <label>${t('obstacle.height')}</label>
                    <div class="input-row">
                        <input type="number" id="prop-obs-height" min="0.1" max="${room.height}" step="0.1" value="${obstacle.height}">
                        <span class="input-unit">m</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>${t('obstacle.position')}</label>
                    <div class="input-row">
                        <span class="input-unit" style="min-width:14px">X</span>
                        <input type="number" id="prop-obs-x" step="0.25" value="${obstacle.position.x.toFixed(2)}">
                        <span class="input-unit" style="min-width:14px">Z</span>
                        <input type="number" id="prop-obs-z" step="0.25" value="${obstacle.position.z.toFixed(2)}">
                    </div>
                </div>
            </div>
            <div class="props-section" style="padding-top:8px;">
                <button class="btn-secondary" id="btn-delete-obstacle" style="width:100%; color:var(--error); border-color: var(--error);">
                    ${t('obstacle.delete')}
                </button>
            </div>
        `;

        this._attachObstacleListeners();
    }

    _attachObstacleListeners() {
        const propW = document.getElementById('prop-obs-width');
        const propD = document.getElementById('prop-obs-depth');
        const propH = document.getElementById('prop-obs-height');
        const propX = document.getElementById('prop-obs-x');
        const propZ = document.getElementById('prop-obs-z');
        const btnDel = document.getElementById('btn-delete-obstacle');

        const emit = () => {
            if (this.onObstacleParamChange && this.currentObstacle) {
                this.onObstacleParamChange(this.currentObstacle.id);
            }
        };

        if (propW) propW.addEventListener('input', (e) => {
            if (this.currentObstacle) {
                this.currentObstacle.width = Math.max(0.1, parseFloat(e.target.value) || 0.4);
                if (this.currentObstacle.shape === 'cylinder') this.currentObstacle.depth = this.currentObstacle.width;
                emit();
            }
        });
        if (propD) propD.addEventListener('input', (e) => {
            if (this.currentObstacle) {
                this.currentObstacle.depth = Math.max(0.1, parseFloat(e.target.value) || 0.4);
                emit();
            }
        });
        if (propH) propH.addEventListener('input', (e) => {
            if (this.currentObstacle) {
                this.currentObstacle.height = Math.max(0.1, parseFloat(e.target.value) || 1.0);
                emit();
            }
        });
        if (propX) propX.addEventListener('input', (e) => {
            if (this.currentObstacle) {
                this.currentObstacle.position.x = parseFloat(e.target.value) || 0;
                emit();
            }
        });
        if (propZ) propZ.addEventListener('input', (e) => {
            if (this.currentObstacle) {
                this.currentObstacle.position.z = parseFloat(e.target.value) || 0;
                emit();
            }
        });
        if (btnDel) btnDel.addEventListener('click', () => {
            if (this.currentObstacle && this.onObstacleDelete) {
                this.onObstacleDelete(this.currentObstacle.id);
            }
        });
    }

    /**
     * Show empty state
     */
    showEmpty() {
        this.currentOutlet = null;
        this.currentResults = null;
        this.container.innerHTML = '';
        if (this.emptyState) {
            this.emptyState.style.display = '';
            this.container.appendChild(this.emptyState);
        }
    }

    // Traffic light helpers
    _trafficLight(value, greenMax, yellowMax, redMax) {
        if (value == null) return '';
        if (value <= greenMax) return 'green';
        if (value <= yellowMax) return 'yellow';
        return 'red';
    }

    _soundTrafficLight(value, limit) {
        if (value == null) return '';
        if (value <= limit - 5) return 'green';
        if (value <= limit) return 'yellow';
        return 'red';
    }
}

const propertiesPanel = new PropertiesPanel();
export default propertiesPanel;
