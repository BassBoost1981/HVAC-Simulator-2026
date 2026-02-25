// ============================================================
// jetPhysics — Analytical jet formulas for HVAC diffusers
// Based on VDI 3803, ASHRAE Fundamentals Ch.20, EN 12238
// ============================================================

import { getEffectiveArea, getType } from './diffuserDB.js';

const G = 9.81;       // gravitational acceleration [m/s²]
const RHO = 1.2;      // air density [kg/m³] at ~20°C
const V_TERMINAL = 0.20; // terminal velocity [m/s] (DIN 1946 / EN 16798)

/**
 * Main calculation function for a single outlet
 * @param {Object} outlet - Outlet configuration
 * @param {Object} room - Room configuration
 * @returns {Object} JetResult with all calculated values
 */
export function calculateOutlet(outlet, room) {
    const { typeKey, sizeData, volumeFlow, supplyTemp, mounting, slotLength, slotDirection, outletCategory } = outlet;
    const { height, temperature: roomTemp } = room;

    // Effective area [m²]
    const aEff = getEffectiveArea(typeKey, sizeData, slotLength);

    // Exit velocity [m/s]
    const vFlow_m3s = volumeFlow / 3600; // m³/h -> m³/s
    const v0 = vFlow_m3s / aEff;

    // Core length [m] (zone of constant velocity)
    const d0 = sizeData.d0 || Math.sqrt(4 * aEff / Math.PI);
    const coreLength = 5 * d0;

    // Jet constants
    const k1 = sizeData.k1;
    const halfAngleRad = (sizeData.halfAngleDeg || 20) * Math.PI / 180;

    // ---- EXHAUST (sink) branch ----
    if (outletCategory === 'exhaust') {
        // Suction reach: same formula as throw, but represents the distance
        // at which the suction velocity drops to terminal velocity
        const suctionReach = k1 * v0 * d0 / V_TERMINAL;

        // Sound power level (exhaust grilles generate noise too)
        const lwA = sizeData.lwRef + 50 * Math.log10(volumeFlow / sizeData.vFlowRef);
        const lpAt3m = lwA - 20 * Math.log10(3) - 8;

        // Pressure drop
        const zeta = getZeta(typeKey);
        const pressureDrop = 0.5 * RHO * v0 * v0 * zeta;

        // Velocity at distance function (suction velocity decay)
        const velocityAtDistance = createVelocityFunction(
            typeKey, sizeData, v0, d0, k1, coreLength
        );

        return {
            outletCategory: 'exhaust',
            exitVelocity: v0,
            throwDistance: suctionReach,
            suctionReach,
            throwDistanceFree: suctionReach,
            throwDistanceCoanda: null,
            coreLength,
            halfAngle: halfAngleRad,
            archimedesNumber: 0,
            detachmentPoint: null,
            soundPowerLevel: lwA,
            soundPressureAt3m: lpAt3m,
            pressureDrop,
            maxVelocityOccupied: 0, // Exhaust creates no free jet in occupied zone
            effectiveArea: aEff,
            velocityAtDistance,
            slotDirection: null
        };
    }

    // ---- SUPPLY (standard) branch ----

    // Throw distance calculation (type-specific)
    let throwDistanceFree;

    if (typeKey === 'slot') {
        // Planar jet: v(x) = k1 * v0 * sqrt(s/x)
        // Solving for x when v = V_TERMINAL:
        // V_T = k1 * v0 * sqrt(s/x_T)
        // x_T = s * (k1 * v0 / V_T)²
        const s = sizeData.slotWidth;
        throwDistanceFree = s * Math.pow(k1 * v0 / V_TERMINAL, 2);
    } else {
        // Round/radial jet: v(x) = k1 * v0 * d0 / x
        // Solving for x when v = V_TERMINAL:
        // x_T = k1 * v0 * d0 / V_T
        throwDistanceFree = k1 * v0 * d0 / V_TERMINAL;
    }

    // Coanda effect (ceiling-mounted outlets with coanda capability)
    // Vertical slot diffusers blow straight down — no Coanda attachment
    const isCeiling = mounting === 'ceiling';
    const typeInfo = getType(typeKey);
    const hasCoanda = typeInfo && typeInfo.coanda && isCeiling
        && !(typeKey === 'slot' && slotDirection === 'vertical');
    const throwDistanceCoanda = hasCoanda ? Math.SQRT2 * throwDistanceFree : throwDistanceFree;
    const throwDistance = hasCoanda ? throwDistanceCoanda : throwDistanceFree;

    // Temperature difference
    const deltaT = Math.abs(roomTemp - supplyTemp);

    // Archimedes number (thermal buoyancy vs inertia)
    const Ar = deltaT > 0.1 ? (G * deltaT * d0) / ((roomTemp + 273.15) * v0 * v0) : 0;

    // Detachment point (where Coanda effect breaks due to buoyancy)
    let detachmentPoint = null;
    if (hasCoanda && Ar > 0.01 && supplyTemp < roomTemp) {
        detachmentPoint = 0.5 * throwDistanceCoanda / Math.sqrt(Ar);
        // Clamp to throw distance
        detachmentPoint = Math.min(detachmentPoint, throwDistanceCoanda);
    }

    // Sound power level at operating flow [dB(A)]
    // L_W = L_W_ref + 50 * log10(V_dot / V_dot_ref)
    const lwA = sizeData.lwRef + 50 * Math.log10(volumeFlow / sizeData.vFlowRef);

    // Sound pressure level at 3m distance (half-space, ceiling source Q=2)
    // L_p = L_W - 20*log10(r) - 8
    const lpAt3m = lwA - 20 * Math.log10(3) - 8;

    // Pressure drop [Pa] (simplified: Δp = 0.5 * ρ * v0² * ζ)
    const zeta = getZeta(typeKey);
    const pressureDrop = 0.5 * RHO * v0 * v0 * zeta;

    // Maximum velocity in occupied zone (height 0.1-1.8m)
    const maxVelocityOccupied = calcMaxVelocityInOccupied(
        typeKey, sizeData, v0, d0, k1, halfAngleRad,
        height, hasCoanda, detachmentPoint, slotDirection
    );

    // Velocity at distance function (for visualization)
    const velocityAtDistance = createVelocityFunction(
        typeKey, sizeData, v0, d0, k1, coreLength
    );

    return {
        outletCategory: 'supply',
        exitVelocity: v0,
        throwDistance,
        throwDistanceFree,
        throwDistanceCoanda: hasCoanda ? throwDistanceCoanda : null,
        coreLength,
        halfAngle: halfAngleRad,
        archimedesNumber: Ar,
        detachmentPoint,
        soundPowerLevel: lwA,
        soundPressureAt3m: lpAt3m,
        pressureDrop,
        maxVelocityOccupied,
        effectiveArea: aEff,
        velocityAtDistance,
        slotDirection: slotDirection || null
    };
}

/**
 * Pressure loss coefficient per type
 */
function getZeta(typeKey) {
    const zetas = {
        swirl: 2.0,
        plateValve: 2.5,
        slot: 1.8,
        nozzle: 1.5,
        ceilingGrille: 2.0,
        exhaustSwirl: 2.0,
        exhaustPlateValve: 2.5,
        exhaustSlot: 1.8,
        dqjSupply: 2.2,
        dqjExhaust: 2.0,
        dqjslcSupply: 2.5
    };
    return zetas[typeKey] || 2.0;
}

/**
 * Create a velocity-at-distance function for visualization
 */
function createVelocityFunction(typeKey, sizeData, v0, d0, k1, coreLength) {
    if (typeKey === 'slot') {
        const s = sizeData.slotWidth;
        return function (x) {
            if (x <= 0) return v0;
            if (x <= coreLength) return v0;
            return k1 * v0 * Math.sqrt(s / x);
        };
    }

    // Round/radial/compact jets
    return function (x) {
        if (x <= 0) return v0;
        if (x <= coreLength) return v0;
        return k1 * v0 * d0 / x;
    };
}

/**
 * Estimate maximum air velocity in the occupied zone (0.1-1.8m height)
 * This is a simplified model for Phase 1
 */
function calcMaxVelocityInOccupied(typeKey, sizeData, v0, d0, k1, halfAngle, roomHeight, hasCoanda, detachmentPoint, slotDirection) {
    if (typeKey === 'swirl' || typeKey === 'dqjSupply' || typeKey === 'dqjslcSupply') {
        // Swirl diffuser: radial spread along ceiling, then descends
        // The jet velocity decays radially: v(r) ≈ v0 * (d0/r) * kDrall
        // At the occupied zone boundary (1.8m from floor = roomHeight - 1.8 from ceiling):
        const dropHeight = roomHeight - 1.8;
        if (dropHeight <= 0) return v0; // Very low ceiling

        const kDrall = sizeData.kDrall || 0.9;
        // Gaussian decay in vertical direction: exp(-z²/(2σ²)) where σ = 0.1*r
        // At the boundary, the jet has spread to some radial distance
        // Estimate: the jet reaches the occupied zone when it detaches or when
        // the vertical component of velocity carries it down

        // Simplified: at detachment or at the throw distance, the velocity is V_TERMINAL
        // In the occupied zone, it's typically less. Use a conservative estimate:
        const effectiveR = Math.max(1.0, detachmentPoint || throwEstimate(v0, d0, k1));
        const vAtR = k1 * v0 * d0 / effectiveR * kDrall;
        const sigmaAtR = 0.1 * effectiveR;
        const vInOccupied = vAtR * Math.exp(-(dropHeight * dropHeight) / (2 * sigmaAtR * sigmaAtR));
        return Math.max(0, vInOccupied);
    }

    if (typeKey === 'nozzle') {
        // Nozzle: directed jet, could point into occupied zone directly
        // If wall-mounted, the jet is horizontal at some height
        // Simplified: check velocity at the distance where jet centerline
        // intersects occupied zone height (1.5m as reference)
        const jetAngle = halfAngle; // downward angle from horizontal
        const distToOccupied = roomHeight > 3 ? (roomHeight - 1.5) / Math.sin(jetAngle || 0.1) : 3;
        return createVelocityFunction(typeKey, sizeData, v0, d0, k1, 5 * d0)(distToOccupied);
    }

    if (typeKey === 'plateValve') {
        // Plate valve: hemispherical spread, wide angle
        // Velocity drops fast. At height 1.8m from floor:
        const dropHeight = roomHeight - 1.8;
        if (dropHeight <= 0) return v0;
        return createVelocityFunction(typeKey, sizeData, v0, d0, k1, 5 * d0)(dropHeight);
    }

    if (typeKey === 'slot') {
        const dropHeight = roomHeight - 1.8;
        if (dropHeight <= 0) return v0;
        const s = sizeData.slotWidth;

        if (slotDirection === 'vertical') {
            // Vertical: jet travels straight down from ceiling to occupied zone.
            // Centerline velocity at the occupied-zone boundary (no 0.5 factor).
            const vAtDrop = k1 * v0 * Math.sqrt(s / Math.max(dropHeight, 0.1));
            return vAtDrop;
        }

        // Bidirectional / unidirectional: planar jet along ceiling, then descends
        const vAtDrop = k1 * v0 * Math.sqrt(s / Math.max(dropHeight, 0.1));
        return vAtDrop * 0.5; // Rough estimate: half the centerline velocity at that distance
    }

    return 0;
}

function throwEstimate(v0, d0, k1) {
    return k1 * v0 * d0 / V_TERMINAL;
}

/**
 * Calculate sound pressure level at a given distance
 * Using point source model with half-space radiation (ceiling, Q=2)
 */
export function soundPressureAtDistance(lwA, distance, Q = 2) {
    if (distance <= 0.1) distance = 0.1;
    return lwA + 10 * Math.log10(Q / (4 * Math.PI * distance * distance));
}

/**
 * Sum multiple sound pressure levels [dB(A)]
 */
export function sumSoundLevels(levels) {
    if (levels.length === 0) return 0;
    const sum = levels.reduce((acc, l) => acc + Math.pow(10, l / 10), 0);
    return 10 * Math.log10(sum);
}
