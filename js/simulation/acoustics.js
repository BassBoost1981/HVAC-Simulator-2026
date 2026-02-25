// ============================================================
// acoustics.js — Spatial sound propagation model
// Based on VDI 3803, DIN EN 12354, ISO 3744
// ============================================================

import { ROOM_TYPES, SURFACE_MATERIALS } from './diffuserDB.js';

/**
 * Calculate equivalent absorption area for a room
 * A_α = Σ(S_i · α_i)
 */
export function calcAbsorptionArea(room) {
    const { length, width, height } = room;
    const surfaces = room.surfaces || getDefaultSurfaces(room.roomType);

    const floorArea = length * width;
    const ceilingArea = length * width;
    const wallNS = length * height * 2; // North + South
    const wallEW = width * height * 2;  // East + West

    const A = floorArea * surfaces.floor.alpha +
              ceilingArea * surfaces.ceiling.alpha +
              wallNS * surfaces.wallNS.alpha +
              wallEW * surfaces.wallEW.alpha;

    return Math.max(A, 0.5); // Minimum to prevent division by zero
}

/**
 * Get default surface absorption based on room type
 */
export function getDefaultSurfaces(roomType) {
    switch (roomType) {
        case 'office':
        case 'open_office':
            return {
                ceiling: { alpha: 0.85, material: 'acoustic_tile' },
                floor:   { alpha: 0.15, material: 'carpet_thin' },
                wallNS:  { alpha: 0.05, material: 'plaster' },
                wallEW:  { alpha: 0.08, material: 'plaster_glass' }
            };
        case 'meeting_room':
            return {
                ceiling: { alpha: 0.85, material: 'acoustic_tile' },
                floor:   { alpha: 0.30, material: 'carpet' },
                wallNS:  { alpha: 0.05, material: 'plaster' },
                wallEW:  { alpha: 0.08, material: 'plaster_glass' }
            };
        case 'hospital':
            return {
                ceiling: { alpha: 0.70, material: 'acoustic_tile' },
                floor:   { alpha: 0.03, material: 'vinyl' },
                wallNS:  { alpha: 0.03, material: 'plaster' },
                wallEW:  { alpha: 0.03, material: 'plaster' }
            };
        case 'restaurant':
            return {
                ceiling: { alpha: 0.50, material: 'acoustic_partial' },
                floor:   { alpha: 0.10, material: 'tile' },
                wallNS:  { alpha: 0.05, material: 'plaster' },
                wallEW:  { alpha: 0.10, material: 'glass' }
            };
        default:
            return {
                ceiling: { alpha: 0.85, material: 'acoustic_tile' },
                floor:   { alpha: 0.20, material: 'carpet_medium' },
                wallNS:  { alpha: 0.05, material: 'plaster' },
                wallEW:  { alpha: 0.05, material: 'plaster' }
            };
    }
}

/**
 * Sound pressure level at a point from a single source
 * L_p = L_W + 10*log10(Q/(4π·r²) + 4/A)
 *
 * @param {number} lwA - Sound power level [dB(A)]
 * @param {number} distance - Distance from source [m]
 * @param {number} Q - Directivity factor (1=free, 2=ceiling, 4=edge, 8=corner)
 * @param {number} absorptionArea - Equivalent absorption area [m²]
 * @returns {number} Sound pressure level [dB(A)]
 */
export function soundPressureLevel(lwA, distance, Q, absorptionArea) {
    const r = Math.max(distance, 0.1);
    const directField = Q / (4 * Math.PI * r * r);
    const diffuseField = 4 / absorptionArea;
    return lwA + 10 * Math.log10(directField + diffuseField);
}

/**
 * Sum multiple sound pressure levels
 * L_total = 10*log10(Σ 10^(L_i/10))
 */
export function sumLevels(levels) {
    if (levels.length === 0) return -Infinity;
    const sum = levels.reduce((acc, l) => acc + Math.pow(10, l / 10), 0);
    return 10 * Math.log10(sum);
}

/**
 * Directivity factor Q based on source mounting position
 */
export function getDirectivityQ(mounting, position, room) {
    // Ceiling center = hemisphere Q=2
    // Ceiling near wall = quarter-space Q=4
    // Ceiling corner = eighth-space Q=8
    const halfL = room.length / 2;
    const halfW = room.width / 2;
    const wallThreshold = 0.5; // Distance to consider "near wall"

    const nearWallX = Math.abs(position.x) > halfL - wallThreshold;
    const nearWallZ = Math.abs(position.z) > halfW - wallThreshold;

    if (mounting === 'ceiling') {
        if (nearWallX && nearWallZ) return 8;  // Corner
        if (nearWallX || nearWallZ) return 4;  // Edge
        return 2; // Center of ceiling (hemisphere)
    }
    if (mounting === 'wall') return 4;
    return 2; // Default
}

/**
 * Generate a full sound heatmap for the room
 * Returns a 2D grid of dB(A) values
 *
 * @param {Array} outlets - Array of { position3D, soundPowerLevel }
 * @param {Object} room - Room data
 * @param {number} gridSpacing - Grid spacing in meters (default 0.5)
 * @param {number} listenerHeight - Height of measurement plane (default 1.2)
 * @returns {Object} { grid: Float32Array, cols, rows, minVal, maxVal, gridSpacing, originX, originZ }
 */
export function generateSoundHeatmap(outlets, room, gridSpacing = 0.5, listenerHeight = 1.2) {
    const halfL = room.length / 2;
    const halfW = room.width / 2;

    const cols = Math.ceil(room.length / gridSpacing) + 1;
    const rows = Math.ceil(room.width / gridSpacing) + 1;
    const grid = new Float32Array(cols * rows);

    const absorptionArea = calcAbsorptionArea(room);

    let minVal = Infinity;
    let maxVal = -Infinity;

    for (let iz = 0; iz < rows; iz++) {
        for (let ix = 0; ix < cols; ix++) {
            const worldX = -halfL + ix * gridSpacing;
            const worldZ = -halfW + iz * gridSpacing;

            // Sum contributions from all outlets
            const levels = [];
            for (const outlet of outlets) {
                const dx = worldX - outlet.position3D.x;
                const dy = listenerHeight - outlet.position3D.y;
                const dz = worldZ - outlet.position3D.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                const Q = getDirectivityQ(outlet.mounting, outlet.position3D, room);
                const lp = soundPressureLevel(outlet.soundPowerLevel, dist, Q, absorptionArea);
                levels.push(lp);
            }

            const totalLp = levels.length > 0 ? sumLevels(levels) : 0;
            const idx = iz * cols + ix;
            grid[idx] = totalLp;

            if (totalLp < minVal) minVal = totalLp;
            if (totalLp > maxVal) maxVal = totalLp;
        }
    }

    return {
        grid,
        cols,
        rows,
        minVal,
        maxVal,
        gridSpacing,
        originX: -halfL,
        originZ: -halfW,
        listenerHeight
    };
}

/**
 * Generate a velocity heatmap on a horizontal plane
 * @param {Array} outlets - Array of { position3D, jetResult }
 * @param {Object} room - Room data
 * @param {number} gridSpacing - Grid spacing [m]
 * @param {number} planeHeight - Height of cut plane [m]
 * @returns {Object} { grid, cols, rows, minVal, maxVal, ... }
 */
export function generateVelocityHeatmap(outlets, room, gridSpacing = 0.5, planeHeight = 1.2) {
    const halfL = room.length / 2;
    const halfW = room.width / 2;

    const cols = Math.ceil(room.length / gridSpacing) + 1;
    const rows = Math.ceil(room.width / gridSpacing) + 1;
    const grid = new Float32Array(cols * rows);

    let minVal = Infinity;
    let maxVal = -Infinity;

    for (let iz = 0; iz < rows; iz++) {
        for (let ix = 0; ix < cols; ix++) {
            const worldX = -halfL + ix * gridSpacing;
            const worldZ = -halfW + iz * gridSpacing;

            // Sum velocity contributions from all outlets (simplified: take max)
            let maxV = 0;
            for (const outlet of outlets) {
                const dx = worldX - outlet.position3D.x;
                const dz = worldZ - outlet.position3D.z;
                const horizontalDist = Math.sqrt(dx * dx + dz * dz);
                const verticalDist = Math.abs(planeHeight - outlet.position3D.y);
                const totalDist = Math.sqrt(horizontalDist * horizontalDist + verticalDist * verticalDist);

                if (outlet.jetResult && outlet.jetResult.velocityAtDistance) {
                    let v = outlet.jetResult.velocityAtDistance(totalDist);

                    // Apply vertical decay for ceiling outlets (Gaussian profile)
                    if (outlet.mounting === 'ceiling' && horizontalDist > 0.1) {
                        const sigma = 0.12 * horizontalDist;
                        const verticalDecay = Math.exp(-(verticalDist * verticalDist) / (2 * sigma * sigma));
                        v *= verticalDecay;
                    }

                    maxV = Math.max(maxV, v);
                }
            }

            const idx = iz * cols + ix;
            grid[idx] = maxV;

            if (maxV < minVal) minVal = maxV;
            if (maxV > maxVal) maxVal = maxV;
        }
    }

    return {
        grid,
        cols,
        rows,
        minVal,
        maxVal,
        gridSpacing,
        originX: -halfL,
        originZ: -halfW,
        planeHeight
    };
}
