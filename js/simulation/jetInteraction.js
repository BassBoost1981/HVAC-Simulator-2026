// ============================================================
// jetInteraction.js — Multi-outlet velocity vector field
// Berechnet Geschwindigkeitsvektoren aus mehreren Auslässen
// Based on VDI 3803 superposition principle
// ============================================================

/**
 * Get velocity vector at a 3D point from all outlets (vector superposition)
 * Geschwindigkeitsvektor an einem 3D-Punkt aus allen Auslässen
 *
 * @param {number} x - World X coordinate
 * @param {number} y - World Y coordinate (height)
 * @param {number} z - World Z coordinate
 * @param {Array} outlets - Array of outlet data objects:
 *   { position3D, jetResult, typeKey, rotation, outletCategory, mounting }
 * @returns {{ vx: number, vy: number, vz: number, magnitude: number }}
 */
export function getVelocityVectorAt(x, y, z, outlets) {
    let vx = 0, vy = 0, vz = 0;

    for (const outlet of outlets) {
        const jr = outlet.jetResult;
        if (!jr || !jr.velocityAtDistance) continue;

        const ox = outlet.position3D.x;
        const oy = outlet.position3D.y;
        const oz = outlet.position3D.z;

        const dx = x - ox;
        const dy = y - oy;
        const dz = z - oz;
        const horizontalDist = Math.sqrt(dx * dx + dz * dz);
        const verticalDist = Math.abs(dy);
        const totalDist = Math.sqrt(horizontalDist * horizontalDist + dy * dy);

        if (totalDist < 0.01) continue; // At the outlet itself

        const isExhaust = outlet.outletCategory === 'exhaust';

        // Scalar velocity magnitude at this distance
        let speed = jr.velocityAtDistance(totalDist);

        // Apply Gaussian vertical decay for ceiling-mounted supply outlets
        if (!isExhaust && outlet.mounting === 'ceiling' && horizontalDist > 0.1) {
            const sigma = 0.12 * horizontalDist;
            const verticalDecay = Math.exp(-(verticalDist * verticalDist) / (2 * sigma * sigma));
            speed *= verticalDecay;
        }

        if (speed < 0.001) continue;

        // Compute direction vector based on outlet type
        const dir = _getJetDirection(outlet, dx, dy, dz, horizontalDist, totalDist);

        if (isExhaust) {
            // Exhaust: suction direction is TOWARD the outlet
            vx -= dir.x * speed;
            vy -= dir.y * speed;
            vz -= dir.z * speed;
        } else {
            vx += dir.x * speed;
            vy += dir.y * speed;
            vz += dir.z * speed;
        }
    }

    const magnitude = Math.sqrt(vx * vx + vy * vy + vz * vz);
    return { vx, vy, vz, magnitude };
}

/**
 * Get jet direction unit vector from an outlet to a point
 * Richtungsvektor vom Auslass zum Punkt
 */
function _getJetDirection(outlet, dx, dy, dz, horizontalDist, totalDist) {
    const typeKey = outlet.typeKey;
    const rotation = outlet.rotation || 0;

    if (horizontalDist < 0.01 && Math.abs(dy) > 0.01) {
        // Directly below/above — use downward direction
        return { x: 0, y: dy > 0 ? 1 : -1, z: 0 };
    }

    // Normalize horizontal direction
    const hx = horizontalDist > 0.01 ? dx / horizontalDist : 0;
    const hz = horizontalDist > 0.01 ? dz / horizontalDist : 0;

    switch (typeKey) {
        case 'swirl':
        case 'exhaustSwirl':
        case 'dqjSupply':
        case 'dqjExhaust':
        case 'dqjslcSupply':
            // Radial spread along ceiling — mostly horizontal, slight downward
            return _normalize(hx, -0.15, hz);

        case 'slot':
        case 'exhaustSlot': {
            const slotDir = outlet.slotDirection || 'bidirectional';
            if (slotDir === 'vertical') {
                // Vertical slot: jet goes straight down
                return { x: 0, y: -1, z: 0 };
            }
            if (slotDir === 'unidirectional') {
                // Directed along rotation angle
                const dirX = Math.sin(rotation);
                const dirZ = Math.cos(rotation);
                return _normalize(dirX, -0.1, dirZ);
            }
            // Bidirectional: perpendicular to slot length, along ceiling
            // Slot is along X by default, so jet goes in ±Z direction
            const perpX = -Math.sin(rotation);
            const perpZ = Math.cos(rotation);
            // Determine which side the point is on
            const projDist = dx * perpX + dz * perpZ;
            const sign = projDist >= 0 ? 1 : -1;
            return _normalize(sign * perpX, -0.1, sign * perpZ);
        }

        case 'nozzle':
            // Directed jet — primarily downward at an angle
            return _normalize(hx * 0.5, -0.85, hz * 0.5);

        case 'plateValve':
        case 'exhaustPlateValve':
            // Hemispherical spread — mostly downward with radial component
            return _normalize(hx * 0.4, -0.9, hz * 0.4);

        case 'ceilingGrille':
            // Grid pattern — mostly straight up (for exhaust suction)
            return _normalize(hx * 0.2, -0.95, hz * 0.2);

        default:
            // Generic: radial from outlet center
            return _normalize(dx / totalDist, dy / totalDist, dz / totalDist);
    }
}

function _normalize(x, y, z) {
    const len = Math.sqrt(x * x + y * y + z * z);
    if (len < 0.001) return { x: 0, y: -1, z: 0 };
    return { x: x / len, y: y / len, z: z / len };
}

/**
 * Compute velocity magnitude at a point using vector sum (for heatmaps)
 * Berechnet die Geschwindigkeits-Magnitude mittels Vektorsumme
 *
 * @param {number} x - World X
 * @param {number} y - World Y (height)
 * @param {number} z - World Z
 * @param {Array} outlets - Outlet data array
 * @returns {number} Velocity magnitude [m/s]
 */
export function getVelocityMagnitudeAt(x, y, z, outlets) {
    return getVelocityVectorAt(x, y, z, outlets).magnitude;
}
