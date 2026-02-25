// ============================================================
// visualization — Full visualization suite
// Phase 2: Particles, Sound Heatmap, Velocity Zones
// ============================================================

import * as THREE from 'three';
import sceneManager from './sceneManager.js';

// Velocity color stops
const VELOCITY_COLORS = [
    { v: 0.0,  r: 0.2, g: 1.0, b: 0.2 },  // Green  (< 0.2 m/s)
    { v: 0.2,  r: 1.0, g: 1.0, b: 0.2 },  // Yellow (0.2-0.5)
    { v: 0.5,  r: 1.0, g: 0.6, b: 0.2 },  // Orange (0.5-1.0)
    { v: 1.0,  r: 1.0, g: 0.2, b: 0.2 },  // Red    (> 1.0)
];

// Sound color stops [dB(A)]
const SOUND_COLORS = [
    { db: 20, r: 0.0, g: 0.4, b: 0.0 },   // Dark green (very quiet)
    { db: 25, r: 0.1, g: 0.7, b: 0.1 },   // Green (quiet)
    { db: 30, r: 0.4, g: 0.9, b: 0.2 },   // Light green (acceptable)
    { db: 35, r: 1.0, g: 1.0, b: 0.2 },   // Yellow (borderline)
    { db: 40, r: 1.0, g: 0.6, b: 0.1 },   // Orange (too loud for office)
    { db: 45, r: 1.0, g: 0.2, b: 0.1 },   // Red (too loud)
    { db: 55, r: 0.8, g: 0.0, b: 0.0 },   // Dark red
];

class Visualization {
    constructor() {
        this.cones = new Map();
        this.showCones = true;

        // Particles
        this.particleSystems = new Map(); // outletId -> { points, data }
        this.showParticles = false;
        this.particlesPlaying = true;
        this.particleCount = 800;

        // Soft glow sprite texture (generated once)
        this._particleTexture = null;

        // Heatmaps
        this.soundHeatmapMesh = null;
        this.velocityHeatmapMesh = null;
        this.showSoundHeatmap = false;
        this.showVelocityZones = false;
        this.sliceHeight = 1.2;

        // Register frame update
        this._frameUpdate = this._updateParticles.bind(this);
    }

    /**
     * Must be called after sceneManager.init()
     */
    init() {
        sceneManager.onUpdate(this._frameUpdate);
        this._particleTexture = this._createGlowTexture();
    }

    /**
     * Create a soft radial glow texture for smoke-like particles
     */
    _createGlowTexture() {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const half = size / 2;
        const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
        gradient.addColorStop(0, 'rgba(255,255,255,1.0)');
        gradient.addColorStop(0.15, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(0.4, 'rgba(255,255,255,0.3)');
        gradient.addColorStop(0.7, 'rgba(255,255,255,0.08)');
        gradient.addColorStop(1, 'rgba(255,255,255,0.0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    // ================================================================
    //  CONES (unchanged from Phase 1)
    // ================================================================

    updateCone(outlet, jetResult, room) {
        this.removeCone(outlet.id);
        if (!this.showCones) return;

        const group = new THREE.Group();
        group.name = `cone_${outlet.id}`;

        // Exhaust outlets: suction cone (inverted, green)
        if (outlet.outletCategory === 'exhaust') {
            const suctionMat = new THREE.MeshBasicMaterial({
                color: 0x44aa66, transparent: true, opacity: 0.12,
                side: THREE.DoubleSide, depthWrite: false
            });
            this._createSuctionCone(group, outlet, jetResult, room, suctionMat);
            sceneManager.visualizationGroup.add(group);
            this.cones.set(outlet.id, group);
            return;
        }

        // Supply outlets: standard cone
        const { throwDistance, halfAngle } = jetResult;
        const { supplyTemp } = outlet;
        const roomTemp = room.temperature;

        let coneColor;
        if (supplyTemp < roomTemp - 1) coneColor = 0x4488ff;
        else if (supplyTemp > roomTemp + 1) coneColor = 0xff6644;
        else coneColor = 0x88aacc;

        const coneMat = new THREE.MeshBasicMaterial({
            color: coneColor, transparent: true, opacity: 0.12,
            side: THREE.DoubleSide, depthWrite: false
        });

        if (outlet.typeKey === 'swirl' || outlet.typeKey === 'plateValve' || outlet.typeKey === 'dqjSupply' || outlet.typeKey === 'dqjslcSupply') {
            this._createRadialCone(group, outlet, jetResult, room, coneMat);
        } else if (outlet.typeKey === 'slot') {
            this._createPlanarFan(group, outlet, jetResult, room, coneMat);
        } else if (outlet.typeKey === 'nozzle') {
            this._createDirectedCone(group, outlet, jetResult, room, coneMat);
        }

        sceneManager.visualizationGroup.add(group);
        this.cones.set(outlet.id, group);
    }

    _createRadialCone(group, outlet, jetResult, room, material) {
        const throwDist = Math.min(jetResult.throwDistance, Math.max(room.length, room.width));
        const dropHeight = Math.min(throwDist * 0.25, room.height * 0.7);
        const segments = 48;
        const topRadius = outlet.sizeData.d0 / 2;

        const geo = new THREE.CylinderGeometry(topRadius, throwDist, dropHeight, segments, 1, true);
        const cone = new THREE.Mesh(geo, material);
        cone.position.copy(outlet.position3D);
        cone.position.y -= dropHeight / 2;
        group.add(cone);

        // Floor ring
        const ringGeo = new THREE.RingGeometry(throwDist - 0.03, throwDist + 0.03, segments);
        const ringMat = new THREE.MeshBasicMaterial({
            color: material.color, transparent: true, opacity: 0.15,
            side: THREE.DoubleSide, depthWrite: false
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(outlet.position3D.x, 0.01, outlet.position3D.z);
        group.add(ring);
    }

    _createPlanarFan(group, outlet, jetResult, room, material) {
        const throwDist = Math.min(jetResult.throwDistance, Math.max(room.length, room.width));
        const dropHeight = Math.min(room.height * 0.6, throwDist * 0.4);
        const dir = outlet.slotDirection || 'bidirectional';

        if (dir === 'vertical') {
            // Cone pointing straight down from ceiling toward floor
            const coneHeight = Math.min(room.height * 0.8, throwDist * 0.6);
            const slotLen = (outlet.slotLength || outlet.sizeData.lengthDefault || 1000) / 1000;
            const bottomSpread = slotLen * 0.4;
            const geo = new THREE.CylinderGeometry(0.02, bottomSpread, coneHeight, 24, 1, true);
            const cone = new THREE.Mesh(geo, material.clone());
            cone.position.copy(outlet.position3D);
            cone.position.y -= coneHeight / 2;
            group.add(cone);
            return;
        }

        // Determine sides: bidirectional = both, unidirectional = +Z only
        const sides = dir === 'unidirectional' ? [1] : [-1, 1];

        for (const side of sides) {
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            shape.lineTo(throwDist, -dropHeight);
            shape.lineTo(throwDist * 0.8, -dropHeight * 0.3);
            shape.lineTo(0, 0);
            const geo = new THREE.ShapeGeometry(shape);
            const fan = new THREE.Mesh(geo, material.clone());
            fan.position.copy(outlet.position3D);
            fan.rotation.y = (outlet.rotation || 0) + (side > 0 ? 0 : Math.PI);
            group.add(fan);
        }
    }

    _createDirectedCone(group, outlet, jetResult, room, material) {
        const throwDist = Math.min(jetResult.throwDistance, Math.max(room.length, room.width) * 1.5);
        const endR = throwDist * Math.tan(jetResult.halfAngle);
        const startR = outlet.sizeData.d0 / 2;

        const geo = new THREE.CylinderGeometry(startR, endR, throwDist, 24, 1, true);
        geo.rotateX(Math.PI / 2);
        const cone = new THREE.Mesh(geo, material);
        cone.position.copy(outlet.position3D);
        cone.position.z -= throwDist / 2;
        cone.rotation.y = outlet.rotation || 0;
        group.add(cone);
    }

    _createSuctionCone(group, outlet, jetResult, room, material) {
        // Inverted cone: wide bottom (suction zone) → narrow top (at grille)
        const suctionReach = Math.min(jetResult.throwDistance, Math.max(room.length, room.width));
        const dropHeight = Math.min(room.height * 0.7, suctionReach * 0.5);
        const segments = 48;
        const topRadius = outlet.sizeData.d0 / 2;
        const bottomRadius = Math.min(suctionReach, room.length / 2, room.width / 2);

        // CylinderGeometry(radiusTop, radiusBottom, height) — top = small (at grille), bottom = large (suction zone)
        const geo = new THREE.CylinderGeometry(topRadius, bottomRadius, dropHeight, segments, 1, true);
        const cone = new THREE.Mesh(geo, material);
        cone.position.copy(outlet.position3D);
        cone.position.y -= dropHeight / 2;
        group.add(cone);

        // Floor ring showing suction reach
        const ringGeo = new THREE.RingGeometry(bottomRadius - 0.03, bottomRadius + 0.03, segments);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x44aa66, transparent: true, opacity: 0.15,
            side: THREE.DoubleSide, depthWrite: false
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(outlet.position3D.x, 0.01, outlet.position3D.z);
        group.add(ring);
    }

    removeCone(outletId) {
        const existing = this.cones.get(outletId);
        if (existing) {
            sceneManager.visualizationGroup.remove(existing);
            existing.traverse(obj => {
                if (obj.isMesh || obj.isLine) sceneManager.disposeMesh(obj);
            });
            this.cones.delete(outletId);
        }
    }

    setConesVisible(visible) {
        this.showCones = visible;
        this.cones.forEach(g => { g.visible = visible; });
    }

    // ================================================================
    //  PARTICLE SYSTEM
    // ================================================================

    /**
     * Create or recreate the particle system for an outlet
     */
    createParticleSystem(outlet, jetResult, room) {
        this.removeParticleSystem(outlet.id);

        const count = this._getParticleCount(outlet);
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);
        const ages = new Float32Array(count);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        // Initialize particles at the outlet position with random ages
        for (let i = 0; i < count; i++) {
            this._resetParticle(i, positions, velocities, ages, outlet, jetResult);
            ages[i] = Math.random() * 5.0; // Stagger initial ages
        }

        // Set initial colors (green for exhaust, white-blue for supply)
        const isExhaust = outlet.outletCategory === 'exhaust';
        for (let i = 0; i < count; i++) {
            colors[i * 3]     = isExhaust ? 0.3 : 0.9;
            colors[i * 3 + 1] = isExhaust ? 0.7 : 0.95;
            colors[i * 3 + 2] = isExhaust ? 0.4 : 1.0;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.18,
            vertexColors: true,
            transparent: true,
            opacity: 0.7,
            depthWrite: false,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending,
            map: this._particleTexture,
            alphaMap: this._particleTexture
        });

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        sceneManager.visualizationGroup.add(points);

        this.particleSystems.set(outlet.id, {
            points,
            positions,
            velocities,
            ages,
            colors,
            sizes,
            count,
            outlet,
            jetResult,
            room
        });
    }

    _getParticleCount() {
        // Budget based on total outlets — more particles for smoother look
        const totalOutlets = this.particleSystems.size + 1;
        if (totalOutlets <= 3) return 1000;
        if (totalOutlets <= 6) return 600;
        if (totalOutlets <= 10) return 350;
        return 200;
    }

    _resetParticle(i, positions, velocities, ages, outlet, jetResult) {
        const pos = outlet.position3D;
        const d0 = outlet.sizeData.d0 || 0.2;
        const v0 = jetResult.exitVelocity;
        const rot = outlet.rotation || 0;
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);

        // Random position within outlet area
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * d0 / 2 * 0.8;

        const i3 = i * 3;

        // Exhaust: particles start randomly in room and drift toward outlet
        if (outlet.outletCategory === 'exhaust') {
            const sysData = this.particleSystems.get(outlet.id);
            const sysRoom = sysData ? sysData.room : null;
            const halfL = sysRoom ? sysRoom.length / 2 : 3;
            const halfW = sysRoom ? sysRoom.width / 2 : 3;
            const roomH = sysRoom ? sysRoom.height : (pos.y || 3);
            // Spawn throughout room, biased toward lower region
            positions[i3] = (Math.random() - 0.5) * halfL * 1.8;
            positions[i3 + 1] = Math.random() * Math.random() * roomH * 0.85 + 0.1;
            positions[i3 + 2] = (Math.random() - 0.5) * halfW * 1.8;
            // Velocity toward outlet — strong enough to overcome gravity
            const dx = pos.x - positions[i3];
            const dy = pos.y - positions[i3 + 1];
            const dz = pos.z - positions[i3 + 2];
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
            const speed = v0 * 0.4;
            velocities[i3] = (dx / dist) * speed;
            velocities[i3 + 1] = (dy / dist) * speed;
            velocities[i3 + 2] = (dz / dist) * speed;
            ages[i] = 0;
            return;
        }

        if (outlet.typeKey === 'swirl' || outlet.typeKey === 'dqjSupply' || outlet.typeKey === 'dqjslcSupply') {
            // Radial from center — rotation irrelevant (symmetric)
            positions[i3] = pos.x + Math.cos(angle) * radius;
            positions[i3 + 1] = pos.y - 0.02;
            positions[i3 + 2] = pos.z + Math.sin(angle) * radius;
            const swirlAngle = angle + Math.PI / 3;
            velocities[i3] = Math.cos(swirlAngle) * v0 * 0.5;
            velocities[i3 + 1] = -v0 * 0.05;
            velocities[i3 + 2] = Math.sin(swirlAngle) * v0 * 0.5;
        } else if (outlet.typeKey === 'slot') {
            // Slot: particles along slot length (local X), blow perpendicular (local Z)
            // Apply outlet.rotation to both position offset and velocity
            const slotLen = (outlet.slotLength || outlet.sizeData.lengthDefault || 1000) / 1000;
            // Local offset: along slot (X), small random across (Z)
            const localX = (Math.random() - 0.5) * slotLen;
            const localZ = (Math.random() - 0.5) * 0.05;
            // Rotate local offset by outlet rotation around Y axis
            positions[i3] = pos.x + localX * cosR - localZ * sinR;
            positions[i3 + 1] = pos.y - 0.02;
            positions[i3 + 2] = pos.z + localX * sinR + localZ * cosR;

            const slotDir = outlet.slotDirection || 'bidirectional';
            if (slotDir === 'vertical') {
                // Strong downward, minimal horizontal
                velocities[i3] = (Math.random() - 0.5) * v0 * 0.03;
                velocities[i3 + 1] = -v0 * 0.5;
                velocities[i3 + 2] = (Math.random() - 0.5) * v0 * 0.03;
            } else if (slotDir === 'unidirectional') {
                // Blow in local +Z, rotated by outlet.rotation
                const speed = v0 * 0.3;
                velocities[i3] = -sinR * speed;
                velocities[i3 + 1] = -v0 * 0.05;
                velocities[i3 + 2] = cosR * speed;
            } else {
                // Bidirectional: random ±Z perpendicular to slot, rotated
                const biDir = Math.random() > 0.5 ? 1 : -1;
                const speed = v0 * 0.3 * biDir;
                velocities[i3] = -sinR * speed;
                velocities[i3 + 1] = -v0 * 0.05;
                velocities[i3 + 2] = cosR * speed;
            }
        } else if (outlet.typeKey === 'nozzle') {
            // Nozzle: forward in local -Z, rotated by outlet.rotation
            const localX = (Math.random() - 0.5) * d0 * 0.5;
            const localY = (Math.random() - 0.5) * d0 * 0.5;
            // Rotate position offset (localX along perpendicular, 0 along forward)
            positions[i3] = pos.x + localX * cosR;
            positions[i3 + 1] = pos.y + localY;
            positions[i3 + 2] = pos.z + localX * sinR;
            // Main velocity in local -Z direction, rotated
            const fwdSpeed = -v0 * 0.8;
            const spreadX = (Math.random() - 0.5) * v0 * 0.1;
            const spreadY = (Math.random() - 0.5) * v0 * 0.1;
            velocities[i3] = spreadX * cosR - fwdSpeed * sinR;
            velocities[i3 + 1] = spreadY;
            velocities[i3 + 2] = spreadX * sinR + fwdSpeed * cosR;
        } else {
            // Plate valve: hemispherical — rotation irrelevant (symmetric)
            positions[i3] = pos.x + Math.cos(angle) * radius;
            positions[i3 + 1] = pos.y - 0.02;
            positions[i3 + 2] = pos.z + Math.sin(angle) * radius;
            velocities[i3] = Math.cos(angle) * v0 * 0.3;
            velocities[i3 + 1] = -v0 * 0.3;
            velocities[i3 + 2] = Math.sin(angle) * v0 * 0.3;
        }

        ages[i] = 0;
    }

    /**
     * Frame update for all particle systems
     */
    _updateParticles() {
        if (!this.showParticles || !this.particlesPlaying) return;

        const dt = 0.016; // ~60fps timestep

        // Collect all exhaust outlets for cross-system suction
        const exhaustSystems = [];
        this.particleSystems.forEach((sys) => {
            if (sys.outlet.outletCategory === 'exhaust') {
                exhaustSystems.push(sys);
            }
        });

        this.particleSystems.forEach((sys) => {
            const { positions, velocities, ages, colors, sizes, count, outlet, jetResult, room, points } = sys;
            const maxAge = 6.0;
            const v0 = jetResult.exitVelocity;
            const d0 = outlet.sizeData.d0 || 0.2;
            const isExhaust = outlet.outletCategory === 'exhaust';

            for (let i = 0; i < count; i++) {
                const i3 = i * 3;
                ages[i] += dt;

                // Reset old particles
                if (ages[i] > maxAge || positions[i3 + 1] < -0.1) {
                    this._resetParticle(i, positions, velocities, ages, outlet, jetResult);
                    continue;
                }

                // Calculate distance from own outlet
                const dx = positions[i3] - outlet.position3D.x;
                const dy = positions[i3 + 1] - outlet.position3D.y;
                const dz = positions[i3 + 2] - outlet.position3D.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                // Get velocity magnitude at this distance
                const vMag = jetResult.velocityAtDistance(Math.max(dist, 0.01));

                // Decay factor
                const decayFactor = Math.max(0.01, vMag / Math.max(v0, 0.01));

                // Apply velocity decay (gentler for exhaust so particles keep moving)
                const decayRate = isExhaust ? 0.995 : (0.98 + decayFactor * 0.02);
                velocities[i3] *= decayRate;
                velocities[i3 + 1] *= decayRate;
                velocities[i3 + 2] *= decayRate;

                // Gravity effect — skip for exhaust (suction dominates)
                if (!isExhaust) {
                    velocities[i3 + 1] -= 0.015 * dt;
                }

                // Turbulence (gentle perturbation for organic flow)
                const turbulence = isExhaust ? 0.008 * vMag : 0.015 * vMag;
                velocities[i3] += (Math.random() - 0.5) * turbulence;
                velocities[i3 + 1] += (Math.random() - 0.5) * turbulence * 0.25;
                velocities[i3 + 2] += (Math.random() - 0.5) * turbulence;

                // Exhaust: continuously steer own particles toward outlet
                if (isExhaust) {
                    const toDx = outlet.position3D.x - positions[i3];
                    const toDy = outlet.position3D.y - positions[i3 + 1];
                    const toDz = outlet.position3D.z - positions[i3 + 2];
                    const toDist = Math.sqrt(toDx * toDx + toDy * toDy + toDz * toDz) || 1;
                    const pullStrength = v0 * 0.6 / Math.max(toDist * toDist, 0.2);
                    velocities[i3] += (toDx / toDist) * pullStrength * dt;
                    velocities[i3 + 1] += (toDy / toDist) * pullStrength * dt;
                    velocities[i3 + 2] += (toDz / toDist) * pullStrength * dt;

                    if (toDist < d0) {
                        this._resetParticle(i, positions, velocities, ages, outlet, jetResult);
                        continue;
                    }
                }

                // Supply particles: apply suction from all exhaust outlets
                if (!isExhaust && exhaustSystems.length > 0) {
                    let absorbed = false;
                    for (const exSys of exhaustSystems) {
                        const exPos = exSys.outlet.position3D;
                        const exD0 = exSys.outlet.sizeData.d0 || 0.2;
                        const exV0 = exSys.jetResult.exitVelocity;
                        const eDx = exPos.x - positions[i3];
                        const eDy = exPos.y - positions[i3 + 1];
                        const eDz = exPos.z - positions[i3 + 2];
                        const eDist = Math.sqrt(eDx * eDx + eDy * eDy + eDz * eDz) || 1;

                        // Suction force: 1/r² sink, scaled by exhaust flow rate
                        // Stronger effect when particle is slower (far from supply jet)
                        const proximityFactor = Math.max(0.1, 1.0 - decayFactor);
                        const suctionStrength = exV0 * 0.4 * proximityFactor / Math.max(eDist * eDist, 0.3);
                        velocities[i3] += (eDx / eDist) * suctionStrength * dt;
                        velocities[i3 + 1] += (eDy / eDist) * suctionStrength * dt;
                        velocities[i3 + 2] += (eDz / eDist) * suctionStrength * dt;

                        // If supply particle reaches exhaust outlet → absorbed, reset at supply
                        if (eDist < exD0 * 1.2) {
                            absorbed = true;
                            break;
                        }
                    }
                    if (absorbed) {
                        this._resetParticle(i, positions, velocities, ages, outlet, jetResult);
                        continue;
                    }
                }

                // Swirl effect for swirl diffusers (supply only)
                if ((outlet.typeKey === 'swirl' || outlet.typeKey === 'dqjSupply' || outlet.typeKey === 'dqjslcSupply') && dist > 0.1 && !isExhaust) {
                    const angle = Math.atan2(dz, dx);
                    const swirlStrength = 0.3 * vMag;
                    velocities[i3] += -Math.sin(angle) * swirlStrength * dt;
                    velocities[i3 + 2] += Math.cos(angle) * swirlStrength * dt;
                }

                // Coanda effect: pull toward ceiling for nearby particles (supply only)
                // Skip for vertical slot diffusers (jet goes straight down)
                const isVerticalSlot = outlet.typeKey === 'slot' && (outlet.slotDirection || 'bidirectional') === 'vertical';
                if (!isExhaust && outlet.mounting === 'ceiling' && dy > -0.5 && !isVerticalSlot) {
                    velocities[i3 + 1] += 0.02 * vMag * dt;
                }

                // Update position
                positions[i3] += velocities[i3] * dt;
                positions[i3 + 1] += velocities[i3 + 1] * dt;
                positions[i3 + 2] += velocities[i3 + 2] * dt;

                // Floor collision
                if (positions[i3 + 1] < 0.01) {
                    positions[i3 + 1] = 0.01;
                    if (isExhaust) {
                        velocities[i3 + 1] = Math.abs(velocities[i3 + 1]) * 0.5 + 0.02;
                    } else {
                        velocities[i3 + 1] *= -0.1;
                        velocities[i3] *= 0.7;
                        velocities[i3 + 2] *= 0.7;
                    }
                }

                // Room bounds (soft bounce)
                const halfL = room.length / 2;
                const halfW = room.width / 2;
                if (Math.abs(positions[i3]) > halfL) {
                    positions[i3] = Math.sign(positions[i3]) * halfL;
                    velocities[i3] *= -0.2;
                }
                if (Math.abs(positions[i3 + 2]) > halfW) {
                    positions[i3 + 2] = Math.sign(positions[i3 + 2]) * halfW;
                    velocities[i3 + 2] *= -0.2;
                }
                if (positions[i3 + 1] > room.height) {
                    positions[i3 + 1] = room.height;
                    velocities[i3 + 1] *= -0.3;
                }

                // Smoke-like color & size based on age and distance
                const ageFrac = ages[i] / maxAge; // 0..1
                const speed = Math.sqrt(
                    velocities[i3] * velocities[i3] +
                    velocities[i3 + 1] * velocities[i3 + 1] +
                    velocities[i3 + 2] * velocities[i3 + 2]
                );

                if (isExhaust) {
                    // Exhaust: green-tinted, fade as approaching outlet
                    const fade = 1.0 - ageFrac;
                    colors[i3]     = 0.4 + 0.3 * fade;   // R
                    colors[i3 + 1] = 0.85 * fade + 0.15;  // G (dominant)
                    colors[i3 + 2] = 0.5 * fade + 0.1;    // B
                } else {
                    // Supply: bright white/blue near outlet → warm fade → transparent
                    const t = Math.min(ageFrac * 1.5, 1.0); // faster color transition
                    // White-blue (0) → light blue (0.3) → warm grey (0.7) → faint (1.0)
                    if (t < 0.3) {
                        const s = t / 0.3;
                        colors[i3]     = 0.9 - 0.3 * s;  // R: 0.9 → 0.6
                        colors[i3 + 1] = 0.95 - 0.2 * s; // G: 0.95 → 0.75
                        colors[i3 + 2] = 1.0;             // B: stays 1.0
                    } else if (t < 0.7) {
                        const s = (t - 0.3) / 0.4;
                        colors[i3]     = 0.6 + 0.1 * s;   // R: 0.6 → 0.7
                        colors[i3 + 1] = 0.75 - 0.25 * s; // G: 0.75 → 0.5
                        colors[i3 + 2] = 1.0 - 0.6 * s;   // B: 1.0 → 0.4
                    } else {
                        const s = (t - 0.7) / 0.3;
                        colors[i3]     = 0.7 - 0.3 * s;   // R: 0.7 → 0.4
                        colors[i3 + 1] = 0.5 - 0.2 * s;   // G: 0.5 → 0.3
                        colors[i3 + 2] = 0.4 - 0.2 * s;   // B: 0.4 → 0.2
                    }
                }

                // Simulate opacity through color brightness (additive blending)
                // Bell curve: fade in quickly, fade out slowly
                const growPhase = Math.min(ageFrac / 0.15, 1.0);         // 0→1 in first 15%
                const shrinkPhase = Math.max(0, (ageFrac - 0.15) / 0.85); // 0→1 from 15%→100%
                const brightness = growPhase * (1.0 - shrinkPhase * shrinkPhase);
                colors[i3]     *= brightness;
                colors[i3 + 1] *= brightness;
                colors[i3 + 2] *= brightness;
            }

            // Update GPU buffers
            points.geometry.attributes.position.needsUpdate = true;
            points.geometry.attributes.color.needsUpdate = true;
        });
    }

    _velocityColor(v) {
        for (let i = VELOCITY_COLORS.length - 1; i >= 0; i--) {
            if (v >= VELOCITY_COLORS[i].v) {
                if (i === VELOCITY_COLORS.length - 1) return VELOCITY_COLORS[i];
                const a = VELOCITY_COLORS[i];
                const b = VELOCITY_COLORS[i + 1];
                const t = (v - a.v) / (b.v - a.v);
                return {
                    r: a.r + (b.r - a.r) * t,
                    g: a.g + (b.g - a.g) * t,
                    b: a.b + (b.b - a.b) * t
                };
            }
        }
        return VELOCITY_COLORS[0];
    }

    removeParticleSystem(outletId) {
        const sys = this.particleSystems.get(outletId);
        if (sys) {
            sceneManager.visualizationGroup.remove(sys.points);
            sys.points.geometry.dispose();
            sys.points.material.dispose();
            this.particleSystems.delete(outletId);
        }
    }

    setParticlesVisible(visible) {
        this.showParticles = visible;
        this.particleSystems.forEach(sys => {
            sys.points.visible = visible;
        });
    }

    setParticlesPlaying(playing) {
        this.particlesPlaying = playing;
    }

    resetParticles() {
        this.particleSystems.forEach(sys => {
            for (let i = 0; i < sys.count; i++) {
                this._resetParticle(i, sys.positions, sys.velocities, sys.ages, sys.outlet, sys.jetResult);
            }
        });
    }

    // ================================================================
    //  SOUND HEATMAP
    // ================================================================

    /**
     * Create/update sound heatmap overlay
     * @param {Object} heatmapData - from acoustics.generateSoundHeatmap()
     */
    updateSoundHeatmap(heatmapData) {
        this.removeSoundHeatmap();

        const { grid, cols, rows, gridSpacing, originX, originZ, listenerHeight } = heatmapData;
        const width = (cols - 1) * gridSpacing;
        const depth = (rows - 1) * gridSpacing;

        // Create DataTexture from grid
        // Grid is row-major: index = iz * cols + ix
        // DataTexture(data, width, height) reads row-major, bottom row first.
        // After PlaneGeometry rotation.x = -PI/2, the texture V-axis flips on Z.
        // We must flip rows (Z-axis) so the heatmap aligns with world coordinates.
        const textureData = new Uint8Array(cols * rows * 4);
        for (let iz = 0; iz < rows; iz++) {
            const flippedIz = rows - 1 - iz; // Flip Z-axis for correct orientation
            for (let ix = 0; ix < cols; ix++) {
                const srcIdx = iz * cols + ix;
                const dstIdx = flippedIz * cols + ix;
                const col = this._soundColor(grid[srcIdx]);
                textureData[dstIdx * 4] = Math.round(col.r * 255);
                textureData[dstIdx * 4 + 1] = Math.round(col.g * 255);
                textureData[dstIdx * 4 + 2] = Math.round(col.b * 255);
                textureData[dstIdx * 4 + 3] = 160; // Alpha
            }
        }

        const texture = new THREE.DataTexture(textureData, cols, rows, THREE.RGBAFormat);
        texture.needsUpdate = true;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;

        const geo = new THREE.PlaneGeometry(width, depth);
        const mat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.soundHeatmapMesh = new THREE.Mesh(geo, mat);
        this.soundHeatmapMesh.rotation.x = -Math.PI / 2;
        this.soundHeatmapMesh.position.set(
            originX + width / 2,
            listenerHeight + 0.005,
            originZ + depth / 2
        );
        this.soundHeatmapMesh.visible = this.showSoundHeatmap;
        sceneManager.visualizationGroup.add(this.soundHeatmapMesh);

        // Add dB labels at grid points
        this._addHeatmapLabels(heatmapData, 'sound');
    }

    _soundColor(db) {
        for (let i = SOUND_COLORS.length - 1; i >= 0; i--) {
            if (db >= SOUND_COLORS[i].db) {
                if (i === SOUND_COLORS.length - 1) return SOUND_COLORS[i];
                const a = SOUND_COLORS[i];
                const b = SOUND_COLORS[i + 1];
                const t = (db - a.db) / (b.db - a.db);
                return {
                    r: a.r + (b.r - a.r) * t,
                    g: a.g + (b.g - a.g) * t,
                    b: a.b + (b.b - a.b) * t
                };
            }
        }
        return SOUND_COLORS[0];
    }

    removeSoundHeatmap() {
        if (this.soundHeatmapMesh) {
            sceneManager.visualizationGroup.remove(this.soundHeatmapMesh);
            sceneManager.disposeMesh(this.soundHeatmapMesh);
            this.soundHeatmapMesh = null;
        }
        // Remove labels
        this._removeHeatmapLabels('sound');
    }

    setSoundHeatmapVisible(visible) {
        this.showSoundHeatmap = visible;
        if (this.soundHeatmapMesh) this.soundHeatmapMesh.visible = visible;
        // Toggle label visibility
        sceneManager.visualizationGroup.children.forEach(c => {
            if (c.name && c.name.startsWith('soundLabel_')) c.visible = visible;
        });
    }

    // ================================================================
    //  VELOCITY ZONES (cut plane)
    // ================================================================

    updateVelocityHeatmap(heatmapData) {
        this.removeVelocityHeatmap();

        const { grid, cols, rows, gridSpacing, originX, originZ, planeHeight } = heatmapData;
        const width = (cols - 1) * gridSpacing;
        const depth = (rows - 1) * gridSpacing;

        // Flip rows (Z-axis) for correct orientation after PlaneGeometry rotation
        const textureData = new Uint8Array(cols * rows * 4);
        for (let iz = 0; iz < rows; iz++) {
            const flippedIz = rows - 1 - iz;
            for (let ix = 0; ix < cols; ix++) {
                const srcIdx = iz * cols + ix;
                const dstIdx = flippedIz * cols + ix;
                const col = this._velocityColor(grid[srcIdx]);
                const alpha = Math.min(200, Math.round(grid[srcIdx] * 600));
                textureData[dstIdx * 4] = Math.round(col.r * 255);
                textureData[dstIdx * 4 + 1] = Math.round(col.g * 255);
                textureData[dstIdx * 4 + 2] = Math.round(col.b * 255);
                textureData[dstIdx * 4 + 3] = alpha;
            }
        }

        const texture = new THREE.DataTexture(textureData, cols, rows, THREE.RGBAFormat);
        texture.needsUpdate = true;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;

        const geo = new THREE.PlaneGeometry(width, depth);
        const mat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.velocityHeatmapMesh = new THREE.Mesh(geo, mat);
        this.velocityHeatmapMesh.rotation.x = -Math.PI / 2;
        this.velocityHeatmapMesh.position.set(
            originX + width / 2,
            planeHeight + 0.003,
            originZ + depth / 2
        );
        this.velocityHeatmapMesh.visible = this.showVelocityZones;
        sceneManager.visualizationGroup.add(this.velocityHeatmapMesh);
    }

    removeVelocityHeatmap() {
        if (this.velocityHeatmapMesh) {
            sceneManager.visualizationGroup.remove(this.velocityHeatmapMesh);
            sceneManager.disposeMesh(this.velocityHeatmapMesh);
            this.velocityHeatmapMesh = null;
        }
    }

    setVelocityZonesVisible(visible) {
        this.showVelocityZones = visible;
        if (this.velocityHeatmapMesh) this.velocityHeatmapMesh.visible = visible;
    }

    setSliceHeight(height) {
        this.sliceHeight = height;
        // Caller should regenerate heatmaps at the new height
    }

    // ================================================================
    //  HEATMAP LABELS (sprite-based dB values on the grid)
    // ================================================================

    _addHeatmapLabels(heatmapData, type) {
        const { grid, cols, rows, gridSpacing, originX, originZ, listenerHeight, planeHeight } = heatmapData;
        const yPos = (listenerHeight || planeHeight || 1.2) + 0.02;

        // Only label every Nth point to avoid clutter
        const labelStep = Math.max(1, Math.floor(2.0 / gridSpacing));

        for (let iz = 0; iz < rows; iz += labelStep) {
            for (let ix = 0; ix < cols; ix += labelStep) {
                const idx = iz * cols + ix;
                const value = grid[idx];
                const worldX = originX + ix * gridSpacing;
                const worldZ = originZ + iz * gridSpacing;

                const label = this._createSmallLabel(
                    type === 'sound' ? `${value.toFixed(0)}` : `${value.toFixed(2)}`,
                    type === 'sound' ? this._soundColor(value) : this._velocityColor(value)
                );
                label.position.set(worldX, yPos, worldZ);
                label.name = `${type}Label_${ix}_${iz}`;
                label.visible = type === 'sound' ? this.showSoundHeatmap : this.showVelocityZones;
                sceneManager.visualizationGroup.add(label);
            }
        }
    }

    _removeHeatmapLabels(type) {
        const toRemove = [];
        sceneManager.visualizationGroup.children.forEach(c => {
            if (c.name && c.name.startsWith(`${type}Label_`)) toRemove.push(c);
        });
        toRemove.forEach(c => {
            sceneManager.visualizationGroup.remove(c);
            if (c.material && c.material.map) c.material.map.dispose();
            if (c.material) c.material.dispose();
        });
    }

    _createSmallLabel(text, color) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 48;
        canvas.height = 24;

        ctx.fillStyle = `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},0.9)`;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 24, 12);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const mat = new THREE.SpriteMaterial({
            map: texture, transparent: true, depthWrite: false, depthTest: false
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(0.5, 0.25, 1);
        return sprite;
    }

    // ================================================================
    //  CLEANUP
    // ================================================================

    clearAll() {
        sceneManager.clearGroup(sceneManager.visualizationGroup);
        this.cones.clear();
        this.particleSystems.clear();
        this.soundHeatmapMesh = null;
        this.velocityHeatmapMesh = null;
    }
}

const visualization = new Visualization();
export default visualization;
