// ============================================================
// diffuserDB — Outlet type catalog with engineering data
// Based on VDI 3803, ASHRAE Handbook, manufacturer data
// ============================================================

export const ROOM_TYPES = {
    office:       { nameDE: 'Einzelbüro',        nameEN: 'Private Office',    maxDbA: 35, nc: 30 },
    open_office:  { nameDE: 'Großraumbüro',      nameEN: 'Open Plan Office',  maxDbA: 40, nc: 35 },
    meeting_room: { nameDE: 'Besprechungsraum',   nameEN: 'Meeting Room',     maxDbA: 35, nc: 30 },
    classroom:    { nameDE: 'Klassenzimmer',       nameEN: 'Classroom',        maxDbA: 35, nc: 30 },
    hospital:     { nameDE: 'Krankenhauszimmer',   nameEN: 'Hospital Room',    maxDbA: 30, nc: 25 },
    restaurant:   { nameDE: 'Restaurant',          nameEN: 'Restaurant',       maxDbA: 45, nc: 40 },
    auditorium:   { nameDE: 'Hörsaal',             nameEN: 'Auditorium',       maxDbA: 30, nc: 25 }
};

export const SURFACE_MATERIALS = {
    concrete:       { nameDE: 'Beton/Putz',        nameEN: 'Concrete/Plaster', alpha: 0.03 },
    plasterboard:   { nameDE: 'Gipskarton',        nameEN: 'Plasterboard',     alpha: 0.08 },
    acoustic_tile:  { nameDE: 'Akustikdecke',      nameEN: 'Acoustic Tile',    alpha: 0.85 },
    carpet:         { nameDE: 'Teppichboden',       nameEN: 'Carpet',           alpha: 0.30 },
    glass:          { nameDE: 'Fenster/Glas',       nameEN: 'Glass/Window',     alpha: 0.12 },
    custom:         { nameDE: 'Benutzerdefiniert', nameEN: 'Custom',           alpha: 0.10 }
};

export const SLOT_DIRECTIONS = {
    bidirectional: { nameDE: 'Beidseitig',        nameEN: 'Bidirectional' },
    unidirectional:{ nameDE: 'Einseitig',         nameEN: 'Unidirectional' },
    vertical:      { nameDE: 'Vertikal nach unten', nameEN: 'Vertical Down' }
};

export const DIFFUSER_TYPES = {
    swirl: {
        nameDE: 'Drallauslass',
        nameEN: 'Swirl Diffuser',
        jetType: 'radial',
        coanda: true,
        defaultMounting: 'ceiling',
        zetaPressure: 2.0,
        sizes: [
            { name: 'DN 200', d0: 0.200, aEff: 0.016, vFlowRange: [100, 200],  vFlowDefault: 150,  lwRef: 30, vFlowRef: 150,  k1: 1.0,  halfAngleDeg: 50, inductionRatio: 12, kDrall: 0.9 },
            { name: 'DN 315', d0: 0.315, aEff: 0.040, vFlowRange: [200, 500],  vFlowDefault: 350,  lwRef: 35, vFlowRef: 350,  k1: 1.0,  halfAngleDeg: 50, inductionRatio: 12, kDrall: 0.9 },
            { name: 'DN 400', d0: 0.400, aEff: 0.064, vFlowRange: [300, 800],  vFlowDefault: 500,  lwRef: 39, vFlowRef: 500,  k1: 1.0,  halfAngleDeg: 50, inductionRatio: 12, kDrall: 0.9 },
            { name: 'DN 625', d0: 0.625, aEff: 0.156, vFlowRange: [800, 2000], vFlowDefault: 1200, lwRef: 46, vFlowRef: 1200, k1: 1.0,  halfAngleDeg: 50, inductionRatio: 12, kDrall: 0.9 }
        ]
    },
    plateValve: {
        nameDE: 'Tellerventil',
        nameEN: 'Plate Valve',
        jetType: 'hemispherical',
        coanda: false,
        defaultMounting: 'ceiling',
        zetaPressure: 2.5,
        sizes: [
            { name: 'DN 125', d0: 0.125, aEff: 0.008, vFlowRange: [30, 80],   vFlowDefault: 50,  lwRef: 20, vFlowRef: 50,   k1: 0.8, halfAngleDeg: 80, inductionRatio: 8 },
            { name: 'DN 160', d0: 0.160, aEff: 0.013, vFlowRange: [50, 150],  vFlowDefault: 100, lwRef: 25, vFlowRef: 100,  k1: 0.8, halfAngleDeg: 80, inductionRatio: 8 },
            { name: 'DN 200', d0: 0.200, aEff: 0.020, vFlowRange: [80, 250],  vFlowDefault: 150, lwRef: 30, vFlowRef: 150,  k1: 0.8, halfAngleDeg: 80, inductionRatio: 8 },
            { name: 'DN 250', d0: 0.250, aEff: 0.031, vFlowRange: [120, 400], vFlowDefault: 250, lwRef: 33, vFlowRef: 250,  k1: 0.8, halfAngleDeg: 80, inductionRatio: 8 }
        ]
    },
    slot: {
        nameDE: 'Schlitzauslass',
        nameEN: 'Slot Diffuser',
        jetType: 'planar',
        coanda: true,
        defaultMounting: 'ceiling',
        zetaPressure: 1.8,
        sizes: [
            { name: '1-Schlitz', slotCount: 1, slotWidth: 0.015, lengthDefault: 1000, vFlowRange: [50, 200],  vFlowDefault: 100, lwRef: 25, vFlowRef: 100, k1: 1.2, halfAngleDeg: 20, inductionRatio: 4 },
            { name: '2-Schlitz', slotCount: 2, slotWidth: 0.015, lengthDefault: 1000, vFlowRange: [100, 400], vFlowDefault: 200, lwRef: 30, vFlowRef: 200, k1: 1.2, halfAngleDeg: 20, inductionRatio: 5 },
            { name: '4-Schlitz', slotCount: 4, slotWidth: 0.015, lengthDefault: 1000, vFlowRange: [200, 800], vFlowDefault: 400, lwRef: 35, vFlowRef: 400, k1: 1.2, halfAngleDeg: 20, inductionRatio: 6 }
        ]
    },
    nozzle: {
        nameDE: 'Düsenauslass',
        nameEN: 'Nozzle Diffuser',
        jetType: 'compact',
        coanda: false,
        defaultMounting: 'wall',
        zetaPressure: 1.5,
        sizes: [
            { name: 'DN 50',  d0: 0.050, aEff: 0.00196, vFlowRange: [20, 100],   vFlowDefault: 50,  lwRef: 27, vFlowRef: 50,   k1: 1.35, halfAngleDeg: 12, inductionRatio: 3 },
            { name: 'DN 75',  d0: 0.075, aEff: 0.00442, vFlowRange: [50, 200],   vFlowDefault: 100, lwRef: 32, vFlowRef: 100,  k1: 1.35, halfAngleDeg: 12, inductionRatio: 3 },
            { name: 'DN 100', d0: 0.100, aEff: 0.00785, vFlowRange: [100, 500],  vFlowDefault: 250, lwRef: 37, vFlowRef: 250,  k1: 1.35, halfAngleDeg: 12, inductionRatio: 3 },
            { name: 'DN 150', d0: 0.150, aEff: 0.01767, vFlowRange: [200, 1000], vFlowDefault: 500, lwRef: 42, vFlowRef: 500,  k1: 1.35, halfAngleDeg: 12, inductionRatio: 3 }
        ]
    },
    // ── SCHAKO DQJ-R-SR Supply (Deckendralldurchlass, runde Frontplatte, Zuluft) ──
    // Data from SCHAKO catalog dqj_de.pdf, Luftstrahlführung "B", with Anschlusskasten
    // k1 derived from vmax diagrams (pages 24-25): k1 = vmax·x / (v0·d0) ≈ 0.8
    dqjSupply: {
        nameDE: 'DQJ-R-SR Zuluft',
        nameEN: 'DQJ-R-SR Supply',
        jetType: 'radial',
        coanda: true,
        defaultMounting: 'ceiling',
        zetaPressure: 2.2,
        manufacturer: 'SCHAKO',
        sizes: [
            { name: 'NW 310', d0: 0.290, aEff: 0.028, vFlowRange: [100, 500],   vFlowDefault: 250,  lwRef: 30, vFlowRef: 200,  k1: 0.80, halfAngleDeg: 45, inductionRatio: 10, kDrall: 0.85 },
            { name: 'NW 400', d0: 0.370, aEff: 0.045, vFlowRange: [150, 700],   vFlowDefault: 400,  lwRef: 32, vFlowRef: 300,  k1: 0.80, halfAngleDeg: 45, inductionRatio: 10, kDrall: 0.85 },
            { name: 'NW 500', d0: 0.470, aEff: 0.072, vFlowRange: [200, 1100],  vFlowDefault: 600,  lwRef: 33, vFlowRef: 500,  k1: 0.80, halfAngleDeg: 45, inductionRatio: 10, kDrall: 0.85 },
            { name: 'NW 600', d0: 0.570, aEff: 0.107, vFlowRange: [300, 1500],  vFlowDefault: 800,  lwRef: 35, vFlowRef: 700,  k1: 0.80, halfAngleDeg: 45, inductionRatio: 10, kDrall: 0.85 },
            { name: 'NW 625', d0: 0.573, aEff: 0.110, vFlowRange: [300, 1600],  vFlowDefault: 900,  lwRef: 35, vFlowRef: 750,  k1: 0.80, halfAngleDeg: 45, inductionRatio: 10, kDrall: 0.85 },
            { name: 'NW 800', d0: 0.710, aEff: 0.170, vFlowRange: [500, 2500],  vFlowDefault: 1400, lwRef: 40, vFlowRef: 1200, k1: 0.80, halfAngleDeg: 45, inductionRatio: 10, kDrall: 0.85 }
        ]
    },
    // ── SCHAKO DQJSLC Supply (Deckendrallauslass mit Ausblasring, Zuluft) ──
    // Data from SCHAKO catalog dqjslc_de.pdf, Luftstrahlführung "B" (hochinduktiv)
    // k1 derived from vmax diagrams (page 11): hochinduktiv → lower k1 ≈ 0.70
    // High induction = faster velocity decay = shorter throw than standard swirl
    dqjslcSupply: {
        nameDE: 'DQJSLC Zuluft',
        nameEN: 'DQJSLC Supply',
        jetType: 'radial',
        coanda: true,
        defaultMounting: 'ceiling',
        zetaPressure: 2.5,
        manufacturer: 'SCHAKO',
        sizes: [
            { name: 'NW 125', d0: 0.123, aEff: 0.0060, vFlowRange: [30, 150],   vFlowDefault: 80,   lwRef: 25, vFlowRef: 80,   k1: 0.70, halfAngleDeg: 50, inductionRatio: 15, kDrall: 0.9 },
            { name: 'NW 160', d0: 0.158, aEff: 0.0100, vFlowRange: [50, 250],   vFlowDefault: 130,  lwRef: 28, vFlowRef: 130,  k1: 0.70, halfAngleDeg: 50, inductionRatio: 15, kDrall: 0.9 },
            { name: 'NW 200', d0: 0.188, aEff: 0.0145, vFlowRange: [70, 400],   vFlowDefault: 200,  lwRef: 30, vFlowRef: 200,  k1: 0.70, halfAngleDeg: 50, inductionRatio: 15, kDrall: 0.9 },
            { name: 'NW 250', d0: 0.248, aEff: 0.0250, vFlowRange: [100, 600],  vFlowDefault: 300,  lwRef: 32, vFlowRef: 300,  k1: 0.70, halfAngleDeg: 50, inductionRatio: 15, kDrall: 0.9 },
            { name: 'NW 315', d0: 0.313, aEff: 0.0400, vFlowRange: [200, 1000], vFlowDefault: 500,  lwRef: 35, vFlowRef: 500,  k1: 0.70, halfAngleDeg: 50, inductionRatio: 15, kDrall: 0.9 }
        ]
    }
};

export const EXHAUST_TYPES = {
    ceilingGrille: {
        nameDE: 'Decken-Abluftgitter',
        nameEN: 'Ceiling Exhaust Grille',
        jetType: 'sink',
        coanda: false,
        defaultMounting: 'ceiling',
        zetaPressure: 2.0,
        sizes: [
            { name: '225×225', d0: 0.225, aEff: 0.030, vFlowRange: [50, 250],   vFlowDefault: 150,  lwRef: 25, vFlowRef: 150, k1: 0.9, halfAngleDeg: 45, inductionRatio: 0 },
            { name: '325×325', d0: 0.325, aEff: 0.063, vFlowRange: [100, 500],  vFlowDefault: 300,  lwRef: 30, vFlowRef: 300, k1: 0.9, halfAngleDeg: 45, inductionRatio: 0 },
            { name: '525×525', d0: 0.525, aEff: 0.165, vFlowRange: [200, 1000], vFlowDefault: 600,  lwRef: 35, vFlowRef: 600, k1: 0.9, halfAngleDeg: 45, inductionRatio: 0 }
        ]
    },
    exhaustSwirl: {
        nameDE: 'Abluft-Drallauslass',
        nameEN: 'Exhaust Swirl Diffuser',
        jetType: 'sink',
        coanda: false,
        defaultMounting: 'ceiling',
        zetaPressure: 2.0,
        sizes: [
            { name: 'DN 200', d0: 0.200, aEff: 0.016, vFlowRange: [100, 200],  vFlowDefault: 150,  lwRef: 30, vFlowRef: 150,  k1: 0.9, halfAngleDeg: 45, inductionRatio: 0 },
            { name: 'DN 315', d0: 0.315, aEff: 0.040, vFlowRange: [200, 500],  vFlowDefault: 350,  lwRef: 35, vFlowRef: 350,  k1: 0.9, halfAngleDeg: 45, inductionRatio: 0 },
            { name: 'DN 400', d0: 0.400, aEff: 0.064, vFlowRange: [300, 800],  vFlowDefault: 500,  lwRef: 39, vFlowRef: 500,  k1: 0.9, halfAngleDeg: 45, inductionRatio: 0 },
            { name: 'DN 625', d0: 0.625, aEff: 0.156, vFlowRange: [800, 2000], vFlowDefault: 1200, lwRef: 46, vFlowRef: 1200, k1: 0.9, halfAngleDeg: 45, inductionRatio: 0 }
        ]
    },
    exhaustPlateValve: {
        nameDE: 'Abluft-Tellerventil',
        nameEN: 'Exhaust Plate Valve',
        jetType: 'sink',
        coanda: false,
        defaultMounting: 'ceiling',
        zetaPressure: 2.5,
        sizes: [
            { name: 'DN 125', d0: 0.125, aEff: 0.008, vFlowRange: [30, 80],   vFlowDefault: 50,  lwRef: 20, vFlowRef: 50,   k1: 0.8, halfAngleDeg: 45, inductionRatio: 0 },
            { name: 'DN 160', d0: 0.160, aEff: 0.013, vFlowRange: [50, 150],  vFlowDefault: 100, lwRef: 25, vFlowRef: 100,  k1: 0.8, halfAngleDeg: 45, inductionRatio: 0 },
            { name: 'DN 200', d0: 0.200, aEff: 0.020, vFlowRange: [80, 250],  vFlowDefault: 150, lwRef: 30, vFlowRef: 150,  k1: 0.8, halfAngleDeg: 45, inductionRatio: 0 },
            { name: 'DN 250', d0: 0.250, aEff: 0.031, vFlowRange: [120, 400], vFlowDefault: 250, lwRef: 33, vFlowRef: 250,  k1: 0.8, halfAngleDeg: 45, inductionRatio: 0 }
        ]
    },
    // ── SCHAKO DQJ-R-SR Exhaust (Deckendralldurchlass, runde Frontplatte, Abluft) ──
    // Data from SCHAKO catalog dqj_de.pdf pages 19-20, with Anschlusskasten
    dqjExhaust: {
        nameDE: 'DQJ-R-SR Abluft',
        nameEN: 'DQJ-R-SR Exhaust',
        jetType: 'sink',
        coanda: false,
        defaultMounting: 'ceiling',
        zetaPressure: 2.0,
        manufacturer: 'SCHAKO',
        sizes: [
            { name: 'NW 310', d0: 0.290, aEff: 0.033, vFlowRange: [100, 600],   vFlowDefault: 300,  lwRef: 28, vFlowRef: 250,  k1: 0.9, halfAngleDeg: 45, inductionRatio: 0 },
            { name: 'NW 400', d0: 0.370, aEff: 0.054, vFlowRange: [150, 800],   vFlowDefault: 450,  lwRef: 30, vFlowRef: 350,  k1: 0.9, halfAngleDeg: 45, inductionRatio: 0 },
            { name: 'NW 500', d0: 0.470, aEff: 0.087, vFlowRange: [200, 1200],  vFlowDefault: 650,  lwRef: 32, vFlowRef: 550,  k1: 0.9, halfAngleDeg: 45, inductionRatio: 0 },
            { name: 'NW 600', d0: 0.570, aEff: 0.128, vFlowRange: [300, 1600],  vFlowDefault: 900,  lwRef: 34, vFlowRef: 750,  k1: 0.9, halfAngleDeg: 45, inductionRatio: 0 },
            { name: 'NW 625', d0: 0.573, aEff: 0.130, vFlowRange: [300, 1700],  vFlowDefault: 950,  lwRef: 34, vFlowRef: 800,  k1: 0.9, halfAngleDeg: 45, inductionRatio: 0 },
            { name: 'NW 800', d0: 0.710, aEff: 0.200, vFlowRange: [500, 2800],  vFlowDefault: 1500, lwRef: 38, vFlowRef: 1300, k1: 0.9, halfAngleDeg: 45, inductionRatio: 0 }
        ]
    },
    exhaustSlot: {
        nameDE: 'Abluft-Schlitzauslass',
        nameEN: 'Exhaust Slot Diffuser',
        jetType: 'sink',
        coanda: false,
        defaultMounting: 'ceiling',
        zetaPressure: 1.8,
        sizes: [
            { name: '1-Schlitz', slotCount: 1, slotWidth: 0.015, lengthDefault: 1000, d0: 0.015, aEff: 0.015, vFlowRange: [50, 200],  vFlowDefault: 100, lwRef: 25, vFlowRef: 100, k1: 0.9, halfAngleDeg: 45, inductionRatio: 0 },
            { name: '2-Schlitz', slotCount: 2, slotWidth: 0.015, lengthDefault: 1000, d0: 0.030, aEff: 0.030, vFlowRange: [100, 400], vFlowDefault: 200, lwRef: 30, vFlowRef: 200, k1: 0.9, halfAngleDeg: 45, inductionRatio: 0 },
            { name: '4-Schlitz', slotCount: 4, slotWidth: 0.015, lengthDefault: 1000, d0: 0.060, aEff: 0.060, vFlowRange: [200, 800], vFlowDefault: 400, lwRef: 35, vFlowRef: 400, k1: 0.9, halfAngleDeg: 45, inductionRatio: 0 }
        ]
    }
};

/**
 * Get all diffuser types as array for sidebar rendering
 */
export function getAllTypes() {
    return Object.entries(DIFFUSER_TYPES).map(([key, data]) => ({
        key,
        ...data
    }));
}

/**
 * Get all exhaust types as array for sidebar rendering
 */
export function getAllExhaustTypes() {
    return Object.entries(EXHAUST_TYPES).map(([key, data]) => ({
        key,
        ...data
    }));
}

/**
 * Get a specific diffuser type (supply or exhaust)
 */
export function getType(typeKey) {
    return DIFFUSER_TYPES[typeKey] || EXHAUST_TYPES[typeKey] || null;
}

/**
 * Get a specific exhaust type
 */
export function getExhaustType(typeKey) {
    return EXHAUST_TYPES[typeKey] || null;
}

/**
 * Get a specific size within a type
 */
export function getSize(typeKey, sizeIndex) {
    const type = DIFFUSER_TYPES[typeKey] || EXHAUST_TYPES[typeKey];
    if (!type || sizeIndex < 0 || sizeIndex >= type.sizes.length) return null;
    return type.sizes[sizeIndex];
}

/**
 * Get a specific size within an exhaust type
 */
export function getExhaustSize(typeKey, sizeIndex) {
    const type = EXHAUST_TYPES[typeKey];
    if (!type || sizeIndex < 0 || sizeIndex >= type.sizes.length) return null;
    return type.sizes[sizeIndex];
}

/**
 * Compute effective area for slot diffusers (dynamic based on slot length)
 */
export function computeSlotAeff(sizeData, slotLengthMm) {
    const slotLengthM = slotLengthMm / 1000;
    return sizeData.slotCount * sizeData.slotWidth * slotLengthM;
}

/**
 * Get effective area, handling both fixed and dynamic (slot) types
 */
export function getEffectiveArea(typeKey, sizeData, slotLengthMm) {
    if (typeKey === 'slot' || typeKey === 'exhaustSlot') {
        return computeSlotAeff(sizeData, slotLengthMm || sizeData.lengthDefault);
    }
    return sizeData.aEff;
}

/**
 * Get room type noise limit
 */
export function getRoomTypeLimit(roomTypeKey) {
    return ROOM_TYPES[roomTypeKey] || ROOM_TYPES.meeting_room;
}
