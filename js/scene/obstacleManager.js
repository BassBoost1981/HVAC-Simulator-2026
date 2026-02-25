// ============================================================
// obstacleManager — Manages room obstacles (columns, furniture)
// Obstacles are simple box/cylinder geometries placed on the floor
// ============================================================

import * as THREE from 'three';
import sceneManager from './sceneManager.js';
import roomBuilder from './roomBuilder.js';

// Obstacle presets
export const OBSTACLE_PRESETS = {
    column_round: {
        nameDE: 'Rundsäule', nameEN: 'Round Column',
        shape: 'cylinder', defaultW: 0.4, defaultD: 0.4, defaultH: 0, // 0 = room height
        color: 0x888899, icon: '●'
    },
    column_square: {
        nameDE: 'Rechtecksäule', nameEN: 'Square Column',
        shape: 'box', defaultW: 0.4, defaultD: 0.4, defaultH: 0,
        color: 0x888899, icon: '■'
    },
    desk: {
        nameDE: 'Schreibtisch', nameEN: 'Desk',
        shape: 'box', defaultW: 1.6, defaultD: 0.8, defaultH: 0.75,
        color: 0x8B6914, icon: '▬'
    },
    cabinet: {
        nameDE: 'Schrank', nameEN: 'Cabinet',
        shape: 'box', defaultW: 1.2, defaultD: 0.6, defaultH: 2.0,
        color: 0x7B6B4A, icon: '▮'
    },
    custom_box: {
        nameDE: 'Box (frei)', nameEN: 'Custom Box',
        shape: 'box', defaultW: 1.0, defaultD: 1.0, defaultH: 1.0,
        color: 0x6a6a7a, icon: '□'
    }
};

class ObstacleManager {
    constructor() {
        this.obstacles = new Map(); // id -> { mesh, data }
        this.obstacleGroup = null;
        this.selectedObstacleId = null;
        this.selectionBox = null;
        this.gridSnap = 0.25;

        // Drag state
        this.isDragging = false;
        this.dragObstacleId = null;

        // Placement state
        this.placementMode = false;
        this.placementPreset = null;
        this.ghostMesh = null;

        // Callbacks
        this.onPlaced = null;
        this.onSelected = null;
        this.onDeselected = null;
        this.onMoved = null;
        this.onDragEnd = null;

        this._boundMouseMove = this._onMouseMove.bind(this);
        this._boundMouseDown = this._onMouseDown.bind(this);
        this._boundMouseUp = this._onMouseUp.bind(this);
    }

    init({ onPlaced, onSelected, onDeselected, onMoved, onDragEnd }) {
        this.onPlaced = onPlaced;
        this.onSelected = onSelected;
        this.onDeselected = onDeselected;
        this.onMoved = onMoved || null;
        this.onDragEnd = onDragEnd || null;

        // Create a dedicated group within roomGroup
        this.obstacleGroup = new THREE.Group();
        this.obstacleGroup.name = 'ObstacleGroup';
        sceneManager.scene.add(this.obstacleGroup);

        const canvas = sceneManager.canvas;
        canvas.addEventListener('pointermove', this._boundMouseMove);
        // Use capture phase so obstacle clicks are processed before outlet clicks
        canvas.addEventListener('pointerdown', this._boundMouseDown, true);
        canvas.addEventListener('pointerup', this._boundMouseUp);
    }

    // ---- Placement ----

    startPlacement(presetKey) {
        this.cancelPlacement();
        const preset = OBSTACLE_PRESETS[presetKey];
        if (!preset) return;

        this.placementMode = true;
        this.placementPreset = { key: presetKey, ...preset };

        const room = roomBuilder.getRoom();
        const h = preset.defaultH === 0 ? (room ? room.height : 3) : preset.defaultH;

        this.ghostMesh = this._createMesh(preset.shape, preset.defaultW, preset.defaultD, h, preset.color, true);
        sceneManager.helperGroup.add(this.ghostMesh);
        document.getElementById('viewport')?.classList.add('placing');
    }

    cancelPlacement() {
        if (this.ghostMesh) {
            sceneManager.helperGroup.remove(this.ghostMesh);
            sceneManager.disposeMesh(this.ghostMesh);
            this.ghostMesh = null;
        }
        this.placementMode = false;
        this.placementPreset = null;
        document.getElementById('viewport')?.classList.remove('placing');
    }

    // ---- Add / Remove ----

    addObstacle(data) {
        const mesh = this._createMesh(data.shape, data.width, data.depth, data.height, data.color, false);
        mesh.position.set(data.position.x, data.height / 2, data.position.z);
        mesh.userData.obstacleId = data.id;
        this.obstacleGroup.add(mesh);
        this.obstacles.set(data.id, { mesh, data });
    }

    removeObstacle(id) {
        const entry = this.obstacles.get(id);
        if (entry) {
            this.obstacleGroup.remove(entry.mesh);
            sceneManager.disposeMesh(entry.mesh);
            this.obstacles.delete(id);
        }
        if (this.selectedObstacleId === id) {
            this._clearSelection();
        }
    }

    updateObstacle(id, data) {
        const entry = this.obstacles.get(id);
        if (!entry) return;

        // Remove old mesh
        this.obstacleGroup.remove(entry.mesh);
        sceneManager.disposeMesh(entry.mesh);

        // Create new mesh with updated dimensions
        const mesh = this._createMesh(data.shape, data.width, data.depth, data.height, data.color, false);
        mesh.position.set(data.position.x, data.height / 2, data.position.z);
        mesh.userData.obstacleId = id;
        this.obstacleGroup.add(mesh);

        entry.mesh = mesh;
        entry.data = data;

        // Update selection visual if selected
        if (this.selectedObstacleId === id) {
            this._clearSelection();
            this.selectObstacle(id);
        }
    }

    // ---- Selection ----

    selectObstacle(id) {
        this._clearSelection();
        const entry = this.obstacles.get(id);
        if (!entry) return;

        this.selectedObstacleId = id;
        const d = entry.data;

        // Create selection wireframe box
        const geo = new THREE.BoxGeometry(d.width + 0.08, d.height + 0.08, d.depth + 0.08);
        const edges = new THREE.EdgesGeometry(geo);
        const mat = new THREE.LineBasicMaterial({ color: 0x4a9eff, linewidth: 2 });
        this.selectionBox = new THREE.LineSegments(edges, mat);
        this.selectionBox.position.set(d.position.x, d.height / 2, d.position.z);
        sceneManager.helperGroup.add(this.selectionBox);
    }

    deselectObstacle() {
        if (this.selectedObstacleId) {
            this._clearSelection();
            if (this.onDeselected) this.onDeselected();
        }
    }

    setGridSnap(value) {
        this.gridSnap = value;
    }

    // ---- Queries ----

    /**
     * Get all obstacle data for collision checks
     * Returns array of { id, shape, position, width, depth, height }
     */
    getObstacleColliders() {
        const colliders = [];
        this.obstacles.forEach((entry, id) => {
            colliders.push({ id, ...entry.data });
        });
        return colliders;
    }

    /**
     * Check if a point (x, z) at a given height is inside any obstacle
     */
    isInsideObstacle(x, y, z) {
        for (const [id, entry] of this.obstacles) {
            const d = entry.data;
            if (y > d.height) continue;

            if (d.shape === 'cylinder') {
                const r = d.width / 2;
                const dx = x - d.position.x;
                const dz = z - d.position.z;
                if (dx * dx + dz * dz <= r * r) return true;
            } else {
                const halfW = d.width / 2;
                const halfD = d.depth / 2;
                if (x >= d.position.x - halfW && x <= d.position.x + halfW &&
                    z >= d.position.z - halfD && z <= d.position.z + halfD) {
                    return true;
                }
            }
        }
        return false;
    }

    // ---- Clear ----

    clearAll() {
        if (this.obstacleGroup) {
            sceneManager.clearGroup(this.obstacleGroup);
        }
        this.obstacles.clear();
        this._clearSelection();
        this.cancelPlacement();
    }

    // ---- Mouse Handlers ----

    _getFloorPlane() {
        return new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    }

    _onMouseMove(event) {
        if (this.placementMode && this.ghostMesh) {
            const point = sceneManager.raycastToPlane(event, this._getFloorPlane());
            if (!point) return;

            const snappedX = Math.round(point.x / this.gridSnap) * this.gridSnap;
            const snappedZ = Math.round(point.z / this.gridSnap) * this.gridSnap;
            const isInside = roomBuilder.isInsideRoom(snappedX, snappedZ);

            this.ghostMesh.position.x = snappedX;
            this.ghostMesh.position.z = snappedZ;

            this.ghostMesh.material.color.setHex(isInside ? 0x4caf50 : 0xf44336);
            this.ghostMesh.material.opacity = isInside ? 0.4 : 0.25;
            return;
        }

        if (this.isDragging && this.dragObstacleId) {
            const point = sceneManager.raycastToPlane(event, this._getFloorPlane());
            if (!point) return;

            const snappedX = Math.round(point.x / this.gridSnap) * this.gridSnap;
            const snappedZ = Math.round(point.z / this.gridSnap) * this.gridSnap;
            if (!roomBuilder.isInsideRoom(snappedX, snappedZ)) return;

            const entry = this.obstacles.get(this.dragObstacleId);
            if (entry) {
                entry.mesh.position.x = snappedX;
                entry.mesh.position.z = snappedZ;
                entry.data.position.x = snappedX;
                entry.data.position.z = snappedZ;

                if (this.selectionBox) {
                    this.selectionBox.position.x = snappedX;
                    this.selectionBox.position.z = snappedZ;
                }

                if (this.onMoved) this.onMoved(this.dragObstacleId, snappedX, snappedZ);
            }
        }
    }

    _onMouseDown(event) {
        if (event.button !== 0) return;

        if (this.placementMode) {
            this._handlePlacement(event);
            return;
        }

        // Don't interact with obstacles while another placement is in progress
        if (document.getElementById('viewport')?.classList.contains('placing') && !this.isDragging) return;

        // Check if clicking on an obstacle
        const meshes = [];
        this.obstacles.forEach(entry => meshes.push(entry.mesh));
        if (meshes.length === 0) return;

        const intersects = sceneManager.raycastFromMouse(event, meshes);
        if (intersects.length > 0) {
            let target = intersects[0].object;
            while (target && !target.userData.obstacleId) {
                target = target.parent;
            }
            if (target && target.userData.obstacleId) {
                const id = target.userData.obstacleId;

                this.selectObstacle(id);
                if (this.onSelected) this.onSelected(id);

                // Start drag
                this.isDragging = true;
                this.dragObstacleId = id;
                sceneManager.controls.enabled = false;
                document.getElementById('viewport')?.classList.add('placing');

                // Signal that this click was handled by obstacleManager
                event._obstacleHandled = true;
                return;
            }
        }
    }

    _onMouseUp(event) {
        if (this.isDragging) {
            const draggedId = this.dragObstacleId;
            this.isDragging = false;
            this.dragObstacleId = null;

            sceneManager.controls.enabled = true;
            document.getElementById('viewport')?.classList.remove('placing');

            if (this.onDragEnd) this.onDragEnd(draggedId);
        }
    }

    _handlePlacement(event) {
        if (!this.placementPreset || !this.ghostMesh) return;
        const point = sceneManager.raycastToPlane(event, this._getFloorPlane());
        if (!point) return;

        const snappedX = Math.round(point.x / this.gridSnap) * this.gridSnap;
        const snappedZ = Math.round(point.z / this.gridSnap) * this.gridSnap;
        if (!roomBuilder.isInsideRoom(snappedX, snappedZ)) return;

        const room = roomBuilder.getRoom();
        const preset = this.placementPreset;
        const h = preset.defaultH === 0 ? (room ? room.height : 3) : preset.defaultH;

        const obstacleData = {
            id: 'obstacle_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            presetKey: preset.key,
            shape: preset.shape,
            width: preset.defaultW,
            depth: preset.defaultD,
            height: h,
            color: preset.color,
            position: { x: snappedX, z: snappedZ }
        };

        this.cancelPlacement();

        if (this.onPlaced) {
            this.onPlaced(obstacleData);
        }
    }

    // ---- Selection helpers ----

    _clearSelection() {
        this.selectedObstacleId = null;
        if (this.selectionBox) {
            sceneManager.helperGroup.remove(this.selectionBox);
            if (this.selectionBox.geometry) this.selectionBox.geometry.dispose();
            if (this.selectionBox.material) this.selectionBox.material.dispose();
            this.selectionBox = null;
        }
    }

    // ---- Mesh creation ----

    _createMesh(shape, width, depth, height, color, isGhost) {
        let geometry;
        if (shape === 'cylinder') {
            geometry = new THREE.CylinderGeometry(width / 2, width / 2, height, 24);
        } else {
            geometry = new THREE.BoxGeometry(width, height, depth);
        }

        const material = new THREE.MeshStandardMaterial({
            color: isGhost ? 0x4caf50 : color,
            transparent: true,
            opacity: isGhost ? 0.4 : 0.7,
            roughness: 0.7,
            metalness: 0.1,
            depthWrite: !isGhost
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = height / 2; // Bottom on floor
        return mesh;
    }
}

const obstacleManager = new ObstacleManager();
export default obstacleManager;
