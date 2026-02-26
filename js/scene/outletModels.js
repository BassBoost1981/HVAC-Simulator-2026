// ============================================================
// outletModels.js — Parametric detailed 3D outlet models
// Detaillierte parametrische 3D-Modelle für Luftauslässe
// ============================================================

import * as THREE from 'three';

/**
 * Color scheme based on ghost/exhaust state
 * Farbschema basierend auf Ghost/Abluft-Status
 */
function _getColors(isGhost, isExhaust) {
    if (isGhost) {
        return {
            frame: 0x4caf50,
            face: 0x4caf50,
            vane: 0x66cc66,
            opacity: 0.45,
            metalness: 0.2,
            roughness: 0.6,
            emissive: 0x000000
        };
    }
    if (isExhaust) {
        return {
            frame: 0xaa7744,
            face: 0xcc8844,
            vane: 0xbb7733,
            opacity: 1.0,
            metalness: 0.7,
            roughness: 0.3,
            emissive: 0x221100
        };
    }
    // Supply
    return {
        frame: 0x8899bb,
        face: 0x6688cc,
        vane: 0x7799cc,
        opacity: 1.0,
        metalness: 0.7,
        roughness: 0.3,
        emissive: 0x111122
    };
}

function _makeMat(color, colors, isGhost) {
    return new THREE.MeshStandardMaterial({
        color,
        transparent: isGhost || colors.opacity < 1,
        opacity: colors.opacity,
        metalness: colors.metalness,
        roughness: colors.roughness,
        emissive: colors.emissive,
        emissiveIntensity: 0.3,
        side: isGhost ? THREE.DoubleSide : THREE.FrontSide
    });
}

// ================================================================
//  SWIRL DIFFUSER — Drallauslass
// ================================================================

function createSwirlModel(d0, isGhost, isExhaust) {
    const group = new THREE.Group();
    const c = _getColors(isGhost, isExhaust);
    const r = d0 / 2;

    // Outer ring / Äußerer Ring
    const torus = new THREE.Mesh(
        new THREE.TorusGeometry(r, r * 0.08, 12, 32),
        _makeMat(c.frame, c, isGhost)
    );
    torus.rotation.x = Math.PI / 2;
    group.add(torus);

    // Faceplate / Frontplatte
    const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.008, 32),
        _makeMat(c.face, c, isGhost)
    );
    group.add(plate);

    // Central hub / Zentraler Hub
    const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.18, r * 0.22, 0.025, 16),
        _makeMat(c.frame, c, isGhost)
    );
    hub.position.y = -0.005;
    group.add(hub);

    // 8 swirl vanes / 8 Drall-Lamellen
    const vaneCount = 8;
    for (let i = 0; i < vaneCount; i++) {
        const angle = (i / vaneCount) * Math.PI * 2;
        const vaneLen = r * 0.6;
        const vane = new THREE.Mesh(
            new THREE.BoxGeometry(vaneLen, 0.003, r * 0.08),
            _makeMat(c.vane, c, isGhost)
        );
        const cx = Math.cos(angle) * r * 0.45;
        const cz = Math.sin(angle) * r * 0.45;
        vane.position.set(cx, -0.01, cz);
        // Swirl angle: 30° offset from radial / Drallwinkel: 30° versetzt
        vane.rotation.y = angle + Math.PI / 6;
        group.add(vane);
    }

    return group;
}

// ================================================================
//  SLOT DIFFUSER — Schlitzauslass
// ================================================================

function createSlotModel(sizeData, isGhost, isExhaust) {
    const group = new THREE.Group();
    const c = _getColors(isGhost, isExhaust);

    const slotLen = (sizeData.lengthDefault || 1000) / 1000;
    const slotW = Math.max((sizeData.slotWidth || 0.015) * (sizeData.slotCount || 1) * 3, 0.06);
    const frameH = 0.025;

    // Outer frame / Äußerer Rahmen
    const frame = new THREE.Mesh(
        new THREE.BoxGeometry(slotLen + 0.02, frameH, slotW + 0.02),
        _makeMat(c.frame, c, isGhost)
    );
    group.add(frame);

    // Inner slot face (recessed) / Innere Schlitzfläche
    const face = new THREE.Mesh(
        new THREE.BoxGeometry(slotLen - 0.01, 0.005, slotW - 0.01),
        _makeMat(c.face, c, isGhost)
    );
    face.position.y = -frameH / 2 + 0.003;
    group.add(face);

    // Parallel slats / Parallele Lamellen
    const slotCount = sizeData.slotCount || 2;
    const spacing = slotW / (slotCount + 1);
    for (let i = 1; i <= slotCount; i++) {
        const slat = new THREE.Mesh(
            new THREE.BoxGeometry(slotLen * 0.92, 0.015, 0.003),
            _makeMat(c.vane, c, isGhost)
        );
        slat.position.set(0, -0.008, -slotW / 2 + i * spacing);
        group.add(slat);
    }

    return group;
}

// ================================================================
//  NOZZLE DIFFUSER — Düsenauslass
// ================================================================

function createNozzleModel(d0, isGhost, isExhaust) {
    const group = new THREE.Group();
    const c = _getColors(isGhost, isExhaust);
    const r = d0 / 2;

    // Outer flange / Äußerer Flansch
    const flange = new THREE.Mesh(
        new THREE.TorusGeometry(r, r * 0.1, 10, 24),
        _makeMat(c.frame, c, isGhost)
    );
    flange.rotation.x = Math.PI / 2;
    group.add(flange);

    // Conical body / Konischer Körper
    const cone = new THREE.Mesh(
        new THREE.ConeGeometry(r * 0.85, r * 1.2, 24, 1, true),
        _makeMat(c.face, c, isGhost)
    );
    cone.position.y = -r * 0.5;
    group.add(cone);

    // Inner nozzle / Innere Düse
    const inner = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.35, r * 0.5, r * 0.6, 16, 1, true),
        _makeMat(c.vane, c, isGhost)
    );
    inner.position.y = -r * 0.25;
    group.add(inner);

    return group;
}

// ================================================================
//  PLATE VALVE — Tellerventil
// ================================================================

function createPlateValveModel(d0, isGhost, isExhaust) {
    const group = new THREE.Group();
    const c = _getColors(isGhost, isExhaust);
    const r = d0 / 2;

    // Cylindrical body / Zylindrischer Korpus
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r * 0.85, 0.04, 24),
        _makeMat(c.frame, c, isGhost)
    );
    group.add(body);

    // Angled plate / Schräge Tellerplatte
    const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.75, r * 0.75, 0.006, 24),
        _makeMat(c.face, c, isGhost)
    );
    plate.position.y = -0.018;
    plate.rotation.x = 0.15; // slight tilt / leichte Neigung
    group.add(plate);

    // Adjustment rod / Verstellstange
    const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8),
        _makeMat(c.vane, c, isGhost)
    );
    rod.position.y = -0.005;
    group.add(rod);

    return group;
}

// ================================================================
//  CEILING GRILLE — Decken-Abluftgitter
// ================================================================

function createCeilingGrilleModel(d0, isGhost, isExhaust) {
    const group = new THREE.Group();
    const c = _getColors(isGhost, isExhaust);
    const side = d0;
    const half = side / 2;

    // Outer frame / Äußerer Rahmen
    const frameThickness = 0.012;
    const frameMat = _makeMat(c.frame, c, isGhost);

    // 4 frame edges / 4 Rahmenleisten
    const edgeH = new THREE.BoxGeometry(side + 0.02, 0.02, frameThickness);
    const edgeV = new THREE.BoxGeometry(frameThickness, 0.02, side + 0.02);

    const top = new THREE.Mesh(edgeH, frameMat);
    top.position.set(0, 0, -half);
    group.add(top);
    const bottom = new THREE.Mesh(edgeH, frameMat);
    bottom.position.set(0, 0, half);
    group.add(bottom);
    const left = new THREE.Mesh(edgeV, frameMat);
    left.position.set(-half, 0, 0);
    group.add(left);
    const right = new THREE.Mesh(edgeV, frameMat);
    right.position.set(half, 0, 0);
    group.add(right);

    // Inner face / Innenfläche
    const face = new THREE.Mesh(
        new THREE.BoxGeometry(side - 0.01, 0.005, side - 0.01),
        _makeMat(c.face, c, isGhost)
    );
    face.position.y = 0.003;
    group.add(face);

    // Grid slats (horizontal) / Gitterlamellen (horizontal)
    const slatCount = Math.max(3, Math.round(side / 0.04));
    const spacing = (side - 0.02) / (slatCount + 1);
    const slatMat = _makeMat(c.vane, c, isGhost);

    for (let i = 1; i <= slatCount; i++) {
        const slat = new THREE.Mesh(
            new THREE.BoxGeometry(side * 0.9, 0.012, 0.002),
            slatMat
        );
        slat.position.set(0, -0.005, -half + 0.01 + i * spacing);
        group.add(slat);
    }

    return group;
}

// ================================================================
//  DQJ DIFFUSER — SCHAKO DQJ-R-SR
// ================================================================

function createDQJModel(d0, isGhost, isExhaust) {
    const group = new THREE.Group();
    const c = _getColors(isGhost, isExhaust);
    const r = d0 / 2;

    // Outer ring / Äußerer Ring
    const outerRing = new THREE.Mesh(
        new THREE.TorusGeometry(r, r * 0.07, 10, 32),
        _makeMat(c.frame, c, isGhost)
    );
    outerRing.rotation.x = Math.PI / 2;
    group.add(outerRing);

    // Faceplate / Frontplatte
    const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.008, 32),
        _makeMat(c.face, c, isGhost)
    );
    group.add(plate);

    // Inner vane ring / Innerer Lamellenring
    const innerRing = new THREE.Mesh(
        new THREE.TorusGeometry(r * 0.55, r * 0.04, 8, 24),
        _makeMat(c.vane, c, isGhost)
    );
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = -0.008;
    group.add(innerRing);

    // Radial vanes (6) / Radiale Lamellen
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const vane = new THREE.Mesh(
            new THREE.BoxGeometry(r * 0.35, 0.003, 0.004),
            _makeMat(c.vane, c, isGhost)
        );
        const cx = Math.cos(angle) * r * 0.72;
        const cz = Math.sin(angle) * r * 0.72;
        vane.position.set(cx, -0.006, cz);
        vane.rotation.y = angle;
        group.add(vane);
    }

    return group;
}

// ================================================================
//  DQJSLC DIFFUSER — SCHAKO DQJSLC
// ================================================================

function createDQJSLCModel(d0, isGhost, isExhaust) {
    const group = new THREE.Group();
    const c = _getColors(isGhost, isExhaust);
    const r = d0 / 2 * 1.15; // outer ring extends beyond d0

    // Outer blowing ring / Äußerer Ausblasring
    const outerRing = new THREE.Mesh(
        new THREE.TorusGeometry(r, r * 0.06, 10, 32),
        _makeMat(c.frame, c, isGhost)
    );
    outerRing.rotation.x = Math.PI / 2;
    group.add(outerRing);

    // Inner ring / Innerer Ring
    const innerR = d0 / 2 * 0.7;
    const innerRing = new THREE.Mesh(
        new THREE.TorusGeometry(innerR, r * 0.04, 8, 24),
        _makeMat(c.vane, c, isGhost)
    );
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = -0.006;
    group.add(innerRing);

    // Faceplate / Frontplatte
    const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.9, r * 0.9, 0.008, 32),
        _makeMat(c.face, c, isGhost)
    );
    group.add(plate);

    // Central disc / Zentrale Scheibe
    const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(d0 * 0.15, d0 * 0.18, 0.02, 16),
        _makeMat(c.frame, c, isGhost)
    );
    disc.position.y = -0.008;
    group.add(disc);

    return group;
}

// ================================================================
//  PUBLIC API
// ================================================================

/**
 * Create a detailed parametric 3D outlet model
 * Erstellt ein detailliertes parametrisches 3D-Auslassmodell
 *
 * @param {string} typeKey - Outlet type key
 * @param {Object} sizeData - Size data from diffuserDB
 * @param {boolean} isGhost - Ghost/placement preview mode
 * @param {string} outletCategory - 'supply' or 'exhaust'
 * @returns {THREE.Group}
 */
export function createDetailedOutletModel(typeKey, sizeData, isGhost, outletCategory) {
    const d0 = sizeData.d0 || 0.2;
    const isExhaust = outletCategory === 'exhaust';

    switch (typeKey) {
        case 'swirl':
        case 'exhaustSwirl':
            return createSwirlModel(d0, isGhost, isExhaust);

        case 'slot':
        case 'exhaustSlot':
            return createSlotModel(sizeData, isGhost, isExhaust);

        case 'nozzle':
            return createNozzleModel(d0, isGhost, isExhaust);

        case 'plateValve':
        case 'exhaustPlateValve':
            return createPlateValveModel(d0, isGhost, isExhaust);

        case 'ceilingGrille':
            return createCeilingGrilleModel(d0, isGhost, isExhaust);

        case 'dqjSupply':
        case 'dqjExhaust':
            return createDQJModel(d0, isGhost, isExhaust);

        case 'dqjslcSupply':
            return createDQJSLCModel(d0, isGhost, isExhaust);

        default: {
            // Fallback: simple cylinder
            const group = new THREE.Group();
            const c = _getColors(isGhost, isExhaust);
            const mesh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16),
                _makeMat(c.face, c, isGhost)
            );
            group.add(mesh);
            return group;
        }
    }
}
