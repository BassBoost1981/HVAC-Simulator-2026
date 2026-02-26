// ============================================================
// comfort.js — Thermal comfort & draught rate evaluation
// Based on ISO 7730, DIN EN 16798-1, DIN 1946-2
// ============================================================

import { getRoomTypeLimit } from './diffuserDB.js';
import { getVelocityMagnitudeAt } from './jetInteraction.js';

// Comfort categories per DIN EN 16798-1
const CATEGORIES = {
    I:   { maxVelocity: 0.15, maxDR: 10, tempRange: [23.5, 25.5], label: 'I'   },
    II:  { maxVelocity: 0.20, maxDR: 15, tempRange: [23.0, 26.0], label: 'II'  },
    III: { maxVelocity: 0.25, maxDR: 25, tempRange: [22.0, 27.0], label: 'III' }
};

/**
 * Evaluate overall comfort for a set of outlets in a room
 *
 * @param {Array} outlets - Array of { jetResult, outlet } with calculated results
 * @param {Object} room - { length, width, height, temperature, roomType }
 * @returns {Object} ComfortResult
 */
export function evaluateComfort(outlets, room) {
    const roomLimit = getRoomTypeLimit(room.roomType);

    // Find worst-case velocity in occupied zone
    let maxVelocityOccupied = 0;
    let totalSoundLevels = [];

    // Collect sound levels from all outlets
    for (const { jetResult } of outlets) {
        if (!jetResult) continue;
        if (jetResult.soundPowerLevel != null) {
            totalSoundLevels.push(jetResult.soundPowerLevel);
        }
    }

    // Multi-outlet interaction: sample 10×10×3 grid in occupied zone
    const supplyOutlets = outlets.filter(o => {
        const cat = o.outlet?.outletCategory || o.jetResult?.outletCategory;
        return cat !== 'exhaust' && o.jetResult;
    });

    if (supplyOutlets.length > 1 && room.length && room.width) {
        // Build outlet data array for vector field
        const outletData = outlets
            .filter(o => o.jetResult)
            .map(o => ({
                position3D: o.outlet?.position3D || o.position3D,
                jetResult: o.jetResult,
                typeKey: o.outlet?.typeKey || o.typeKey || 'swirl',
                rotation: o.outlet?.rotation || 0,
                outletCategory: o.outlet?.outletCategory || o.jetResult?.outletCategory || 'supply',
                mounting: o.outlet?.mounting || 'ceiling',
                slotDirection: o.outlet?.slotDirection || null
            }));

        const halfL = room.length / 2;
        const halfW = room.width / 2;
        const stepsX = 10, stepsZ = 10, stepsY = 3;
        const dxStep = room.length / stepsX;
        const dzStep = room.width / stepsZ;
        // Occupied zone heights: 0.1m, 1.0m, 1.8m
        const heights = [0.1, 1.0, 1.8];

        for (let iy = 0; iy < stepsY; iy++) {
            for (let iz = 0; iz < stepsZ; iz++) {
                for (let ix = 0; ix < stepsX; ix++) {
                    const wx = -halfL + (ix + 0.5) * dxStep;
                    const wz = -halfW + (iz + 0.5) * dzStep;
                    const wy = heights[iy];
                    const v = getVelocityMagnitudeAt(wx, wy, wz, outletData);
                    if (v > maxVelocityOccupied) maxVelocityOccupied = v;
                }
            }
        }
    } else {
        // Single outlet or no interaction: use per-outlet max
        for (const { jetResult, outlet } of outlets) {
            if (!jetResult) continue;
            const isExhaust = outlet?.outletCategory === 'exhaust' || jetResult.outletCategory === 'exhaust';
            if (!isExhaust && jetResult.maxVelocityOccupied > maxVelocityOccupied) {
                maxVelocityOccupied = jetResult.maxVelocityOccupied;
            }
        }
    }

    // Total sound level (summed)
    const totalSoundLevel = totalSoundLevels.length > 0
        ? 10 * Math.log10(totalSoundLevels.reduce((s, l) => s + Math.pow(10, l / 10), 0))
        : 0;

    // Draught rate at worst point (using max velocity in occupied zone)
    const draughtRate = calcDraughtRate(
        room.temperature,
        maxVelocityOccupied,
        40 // Typical turbulence intensity 40% for mixed ventilation
    );

    // Velocity compliance
    const velocityCategory = getVelocityCategory(maxVelocityOccupied);

    // Sound compliance
    const soundCompliant = totalSoundLevel <= roomLimit.maxDbA;
    const soundMargin = roomLimit.maxDbA - totalSoundLevel;

    // Overall category: worst of velocity and sound
    let overallCategory;
    if (!soundCompliant || velocityCategory === 'FAIL') {
        overallCategory = 'FAIL';
    } else {
        overallCategory = velocityCategory;
    }

    return {
        maxVelocityOccupied,
        velocityCategory,
        draughtRate,
        draughtRateOk: draughtRate < CATEGORIES.II.maxDR,
        totalSoundLevel,
        soundLimit: roomLimit.maxDbA,
        soundCompliant,
        soundMargin,
        overallCategory,
        categories: CATEGORIES
    };
}

/**
 * Calculate Draught Rate (Zugluftrate) per ISO 7730
 *
 * DR = (34 - T_local) * (v - 0.05)^0.62 * (0.37 * v * Tu + 3.14)
 *
 * @param {number} tLocal - Local air temperature [°C]
 * @param {number} v - Local air velocity [m/s]
 * @param {number} tu - Turbulence intensity [%] (typically 30-60%)
 * @returns {number} Draught rate [%]
 */
export function calcDraughtRate(tLocal, v, tu = 40) {
    if (v <= 0.05) return 0;

    const dr = (34 - tLocal) * Math.pow(v - 0.05, 0.62) * (0.37 * v * tu + 3.14);
    return Math.max(0, Math.min(100, dr));
}

/**
 * Determine velocity comfort category
 */
export function getVelocityCategory(maxV) {
    if (maxV <= CATEGORIES.I.maxVelocity) return 'I';
    if (maxV <= CATEGORIES.II.maxVelocity) return 'II';
    if (maxV <= CATEGORIES.III.maxVelocity) return 'III';
    return 'FAIL';
}

/**
 * Get a human-readable comfort summary
 */
export function getComfortSummary(comfortResult, lang = 'de') {
    const { overallCategory, draughtRate, maxVelocityOccupied, soundCompliant, soundMargin } = comfortResult;

    const labels = {
        de: {
            I: 'Kategorie I — Hoher Komfort',
            II: 'Kategorie II — Normaler Komfort',
            III: 'Kategorie III — Akzeptabler Komfort',
            FAIL: 'Nicht konform — Grenzwerte überschritten'
        },
        en: {
            I: 'Category I — High Comfort',
            II: 'Category II — Normal Comfort',
            III: 'Category III — Acceptable Comfort',
            FAIL: 'Non-compliant — Limits exceeded'
        }
    };

    const recommendations = [];

    if (lang === 'de') {
        if (maxVelocityOccupied > 0.20) {
            recommendations.push('Luftgeschwindigkeit in der Aufenthaltszone reduzieren (Volumenstrom verringern oder Auslasstyp anpassen).');
        }
        if (draughtRate > 15) {
            recommendations.push(`Zugluftrate ${draughtRate.toFixed(1)}% überschreitet 15% — Zulufttemperatur erhöhen oder Auslässe umpositionieren.`);
        }
        if (!soundCompliant) {
            recommendations.push(`Schallpegel überschreitet Grenzwert um ${Math.abs(soundMargin).toFixed(1)} dB(A) — größere Auslässe mit niedrigerer Geschwindigkeit verwenden.`);
        }
        if (recommendations.length === 0) {
            recommendations.push('Alle Komfortkriterien erfüllt.');
        }
    } else {
        if (maxVelocityOccupied > 0.20) {
            recommendations.push('Reduce air velocity in occupied zone (lower volume flow or adjust outlet type).');
        }
        if (draughtRate > 15) {
            recommendations.push(`Draught rate ${draughtRate.toFixed(1)}% exceeds 15% — increase supply temperature or reposition outlets.`);
        }
        if (!soundCompliant) {
            recommendations.push(`Sound level exceeds limit by ${Math.abs(soundMargin).toFixed(1)} dB(A) — use larger outlets with lower velocity.`);
        }
        if (recommendations.length === 0) {
            recommendations.push('All comfort criteria met.');
        }
    }

    return {
        categoryLabel: (labels[lang] || labels.de)[overallCategory],
        recommendations
    };
}
