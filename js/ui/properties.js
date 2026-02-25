// ============================================================
// properties — Right-side parameter panel with live results
// ============================================================

import { DIFFUSER_TYPES, EXHAUST_TYPES, ROOM_TYPES, SLOT_DIRECTIONS, getType, getSize } from '../simulation/diffuserDB.js';

class PropertiesPanel {
    constructor() {
        this.container = document.getElementById('props-content');
        this.emptyState = document.getElementById('props-empty');
        this.onParamChange = null;
        this.onOutletDelete = null;
        this.currentOutlet = null;
        this.currentRoom = null;
        this.currentResults = null;
    }

    init(onParamChange, onOutletDelete) {
        this.onParamChange = onParamChange;
        this.onOutletDelete = onOutletDelete;
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
                <div class="props-section-title">Raum</div>
                <div class="result-row">
                    <span class="result-label">Abmessungen</span>
                    <span class="result-value">${room.length} × ${room.width} × ${room.height}</span>
                    <span class="result-unit">m</span>
                </div>
                <div class="result-row">
                    <span class="result-label">Grundfläche</span>
                    <span class="result-value">${area}</span>
                    <span class="result-unit">m²</span>
                </div>
                <div class="result-row">
                    <span class="result-label">Volumen</span>
                    <span class="result-value">${volume}</span>
                    <span class="result-unit">m³</span>
                </div>
                <div class="result-row">
                    <span class="result-label">Raumtyp</span>
                    <span class="result-value">${roomType ? roomType.nameDE : room.roomType}</span>
                    <span class="result-unit"></span>
                </div>
                <div class="result-row">
                    <span class="result-label">Temperatur</span>
                    <span class="result-value">${room.temperature}</span>
                    <span class="result-unit">°C</span>
                </div>
                <div class="result-row">
                    <span class="result-label">Schallgrenze</span>
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
            `<option value="${key}" ${key === outlet.typeKey ? 'selected' : ''}>${data.nameDE}</option>`
        ).join('');

        // Slot-specific fields (only for supply slot)
        let slotField = '';
        if (outlet.typeKey === 'slot') {
            const dirOptions = Object.entries(SLOT_DIRECTIONS).map(([key, data]) =>
                `<option value="${key}" ${key === (outlet.slotDirection || 'bidirectional') ? 'selected' : ''}>${data.nameDE}</option>`
            ).join('');
            slotField = `
            <div class="form-group">
                <label>Schlitzlänge</label>
                <div class="input-row">
                    <input type="number" id="prop-slot-length" min="300" max="3000" step="50"
                           value="${outlet.slotLength || outlet.sizeData.lengthDefault}">
                    <span class="input-unit">mm</span>
                </div>
            </div>
            <div class="form-group">
                <label>Ausblasrichtung</label>
                <select id="prop-slot-direction">${dirOptions}</select>
            </div>
            `;
        }

        // Supply temperature field (only for supply outlets)
        const supplyTempField = isExhaust ? '' : `
                <div class="form-group">
                    <label>Zulufttemperatur</label>
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
        const throwLabel = isExhaust ? 'Saugreichweite' : 'Wurfweite x₀.₂';
        const sectionTitle = isExhaust ? 'Abluft-Parameter' : 'Auslass-Parameter';
        const maxVLabel = isExhaust ? 'Max. v Aufenthaltsz.' : 'Max. v Aufenthaltsz.';
        const maxVValue = isExhaust ? '—' : (results ? results.maxVelocityOccupied.toFixed(2) : '—');

        // Exhaust note
        const exhaustNote = isExhaust ? `
                <div class="result-row" style="opacity:0.6; font-style:italic;">
                    <span class="result-label">Abluft — kein Freistrahl</span>
                </div>` : '';

        this.container.innerHTML = `
            <div class="props-section">
                <div class="props-section-title">${sectionTitle}</div>
                <div class="form-group">
                    <label>Typ</label>
                    <select id="prop-type">${typeOptions}</select>
                </div>
                <div class="form-group">
                    <label>Größe</label>
                    <select id="prop-size">${sizeOptions}</select>
                </div>
                <div class="form-group">
                    <label>Volumenstrom</label>
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
                    <label>Position</label>
                    <div class="input-row">
                        <span class="input-unit" style="min-width:14px">X</span>
                        <input type="number" id="prop-pos-x" step="0.25" value="${outlet.position3D.x.toFixed(2)}">
                        <span class="input-unit" style="min-width:14px">Z</span>
                        <input type="number" id="prop-pos-z" step="0.25" value="${outlet.position3D.z.toFixed(2)}">
                    </div>
                </div>
            </div>

            <div class="props-section">
                <div class="props-section-title">Berechnungsergebnisse</div>
                ${exhaustNote}
                <div class="result-row">
                    <span class="result-label">Austrittsgeschw. v₀</span>
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
                    <span class="result-label" style="font-size:10px; opacity:0.6">  davon Coanda</span>
                    <span class="result-value" style="font-size:11px; opacity:0.6">${results.throwDistanceCoanda.toFixed(1)}</span>
                    <span class="result-unit">m</span>
                </div>` : ''}
                ${!isExhaust && results?.detachmentPoint ? `
                <div class="result-row">
                    <span class="result-label" style="font-size:10px; opacity:0.6">  Ablösepunkt</span>
                    <span class="result-value" style="font-size:11px; opacity:0.6">${results.detachmentPoint.toFixed(1)}</span>
                    <span class="result-unit">m</span>
                </div>` : ''}
                <div class="result-row">
                    <span class="result-label">Druckverlust Δp</span>
                    <span class="result-value">${results ? results.pressureDrop.toFixed(0) : '—'}</span>
                    <span class="result-unit">Pa</span>
                </div>
                <div class="result-row">
                    <span class="result-label">Schallleistung Lw</span>
                    <span class="result-value">${results ? results.soundPowerLevel.toFixed(1) : '—'}</span>
                    <span class="result-unit">dB(A)</span>
                    <span class="traffic-light ${soundColor}"></span>
                </div>
                <div class="result-row">
                    <span class="result-label">Schallpegel 3 m</span>
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
                    <span class="result-label">Eff. Fläche</span>
                    <span class="result-value">${results ? (results.effectiveArea * 10000).toFixed(0) : '—'}</span>
                    <span class="result-unit">cm²</span>
                </div>
            </div>

            ${comfortResult ? `
            <div class="props-section">
                <div class="props-section-title">Komfortbewertung</div>
                <div class="result-row">
                    <span class="result-label">Kategorie</span>
                    <span class="result-value">${comfortResult.overallCategory}</span>
                    <span class="result-unit"></span>
                    <span class="traffic-light ${comfortResult.overallCategory === 'FAIL' ? 'red' : comfortResult.overallCategory === 'III' ? 'yellow' : 'green'}"></span>
                </div>
                <div class="result-row">
                    <span class="result-label">Zugluftrate DR</span>
                    <span class="result-value">${comfortResult.draughtRate.toFixed(1)}</span>
                    <span class="result-unit">%</span>
                    <span class="traffic-light ${comfortResult.draughtRate > 15 ? 'red' : comfortResult.draughtRate > 10 ? 'yellow' : 'green'}"></span>
                </div>
                <div class="result-row">
                    <span class="result-label">Σ Schall vs. Limit</span>
                    <span class="result-value">${comfortResult.totalSoundLevel.toFixed(1)} / ${comfortResult.soundLimit}</span>
                    <span class="result-unit">dB(A)</span>
                    <span class="traffic-light ${comfortResult.soundCompliant ? (comfortResult.soundMargin > 5 ? 'green' : 'yellow') : 'red'}"></span>
                </div>
            </div>
            ` : ''}

            <div class="props-section" style="padding-top:8px;">
                <button class="btn-secondary" id="btn-delete-outlet" style="width:100%; color:var(--error); border-color: var(--error);">
                    Auslass entfernen
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

        const emit = () => {
            if (this.onParamChange && this.currentOutlet) {
                this.onParamChange(this.currentOutlet.id);
            }
        };

        if (propType) {
            propType.addEventListener('change', (e) => {
                if (this.currentOutlet) {
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
                    this.currentOutlet.volumeFlow = parseFloat(e.target.value) || 0;
                    emit();
                }
            });
        }

        if (propTemp) {
            propTemp.addEventListener('input', (e) => {
                if (this.currentOutlet) {
                    this.currentOutlet.supplyTemp = parseFloat(e.target.value) || 18;
                    emit();
                }
            });
        }

        if (propPosX) {
            propPosX.addEventListener('input', (e) => {
                if (this.currentOutlet) {
                    this.currentOutlet.position3D.x = parseFloat(e.target.value) || 0;
                    emit();
                }
            });
        }

        if (propPosZ) {
            propPosZ.addEventListener('input', (e) => {
                if (this.currentOutlet) {
                    this.currentOutlet.position3D.z = parseFloat(e.target.value) || 0;
                    emit();
                }
            });
        }

        if (propSlot) {
            propSlot.addEventListener('input', (e) => {
                if (this.currentOutlet) {
                    this.currentOutlet.slotLength = parseFloat(e.target.value) || 1000;
                    emit();
                }
            });
        }

        if (propSlotDir) {
            propSlotDir.addEventListener('change', (e) => {
                if (this.currentOutlet) {
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
