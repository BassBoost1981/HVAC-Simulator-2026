// ============================================================
// outletPlacer — Interactive outlet placement, selection,
//                drag-move, and rotation
// ============================================================

import * as THREE from 'three';
import sceneManager from './sceneManager.js';
import roomBuilder from './roomBuilder.js';
import { getType } from '../simulation/diffuserDB.js';

class OutletPlacer {
    constructor() {
        this.placementMode = false;
        this.placementData = null;
        this.ghostMesh = null;
        this.ghostIndicator = null;
        this.outlets = new Map(); // id -> { mesh, typeKey, sizeIndex }
        this.selectedOutletId = null;
        this.selectionRing = null;
        this.gridSnap = 0.25;

        // Drag state
        this.isDragging = false;
        this.dragOutletId = null;
        this.dragStartPos = null;

        // Callbacks
        this.onPlaced = null;
        this.onSelected = null;
        this.onDeselected = null;
        this.onMoved = null;
        this.onRotated = null;
        this.onDragEnd = null;

        this._boundMouseMove = this._onMouseMove.bind(this);
        this._boundMouseDown = this._onMouseDown.bind(this);
        this._boundMouseUp = this._onMouseUp.bind(this);
        this._boundKeyDown = this._onKeyDown.bind(this);
    }

    init({ onPlaced, onSelected, onDeselected, onMoved, onRotated, onDragEnd }) {
        this.onPlaced = onPlaced;
        this.onSelected = onSelected;
        this.onDeselected = onDeselected;
        this.onMoved = onMoved || null;
        this.onRotated = onRotated || null;
        this.onDragEnd = onDragEnd || null;

        const canvas = sceneManager.canvas;
        canvas.addEventListener('pointermove', this._boundMouseMove);
        canvas.addEventListener('pointerdown', this._boundMouseDown);
        canvas.addEventListener('pointerup', this._boundMouseUp);
        document.addEventListener('keydown', this._boundKeyDown);
    }

    // ---- Placement Mode ----

    startPlacement(typeKey, sizeIndex, outletCategory) {
        this.cancelPlacement();
        const typeData = getType(typeKey);
        if (!typeData) return;
        const sizeData = typeData.sizes[sizeIndex];
        if (!sizeData) return;

        this.placementMode = true;
        this.placementData = { typeKey, sizeIndex, sizeData, typeData, outletCategory: outletCategory || 'supply' };

        this.ghostMesh = this._createOutletMesh(typeKey, sizeData, true, this.placementData.outletCategory);
        sceneManager.helperGroup.add(this.ghostMesh);

        const indicatorGeo = new THREE.RingGeometry(0.08, 0.12, 32);
        const indicatorMat = new THREE.MeshBasicMaterial({
            color: 0x4caf50, transparent: true, opacity: 0.8,
            side: THREE.DoubleSide, depthWrite: false
        });
        this.ghostIndicator = new THREE.Mesh(indicatorGeo, indicatorMat);
        this.ghostIndicator.rotation.x = -Math.PI / 2;
        sceneManager.helperGroup.add(this.ghostIndicator);

        document.getElementById('viewport')?.classList.add('placing');
    }

    cancelPlacement() {
        if (this.ghostMesh) {
            sceneManager.helperGroup.remove(this.ghostMesh);
            sceneManager.disposeMesh(this.ghostMesh);
            this.ghostMesh = null;
        }
        if (this.ghostIndicator) {
            sceneManager.helperGroup.remove(this.ghostIndicator);
            sceneManager.disposeMesh(this.ghostIndicator);
            this.ghostIndicator = null;
        }
        this.placementMode = false;
        this.placementData = null;
        document.getElementById('viewport')?.classList.remove('placing');
    }

    // ---- Programmatic Placement ----

    placeOutlet(typeKey, sizeIndex, position3D, id, outletCategory) {
        const typeData = getType(typeKey);
        const sizeData = typeData.sizes[sizeIndex];
        const mesh = this._createOutletMesh(typeKey, sizeData, false, outletCategory);
        mesh.position.copy(position3D);
        mesh.userData.outletId = id;
        sceneManager.outletsGroup.add(mesh);
        this.outlets.set(id, { mesh, typeKey, sizeIndex });
    }

    /**
     * Update the direction indicator on a slot outlet mesh
     */
    updateSlotDirectionIndicator(outletId, slotDirection) {
        const entry = this.outlets.get(outletId);
        if (!entry || !entry.mesh) return;

        // Remove existing indicator
        const existing = entry.mesh.getObjectByName('dirIndicator');
        if (existing) {
            entry.mesh.remove(existing);
            existing.geometry?.dispose();
            existing.material?.dispose();
        }

        if (!slotDirection || slotDirection === 'bidirectional') return;

        const indicatorMat = new THREE.MeshBasicMaterial({
            color: 0xffcc00, transparent: true, opacity: 0.9, depthWrite: false
        });

        if (slotDirection === 'unidirectional') {
            // Small cone pointing in +Z direction (will be oriented by outlet rotation)
            const coneGeo = new THREE.ConeGeometry(0.03, 0.1, 8);
            coneGeo.rotateX(Math.PI / 2); // point along +Z
            const cone = new THREE.Mesh(coneGeo, indicatorMat);
            cone.name = 'dirIndicator';
            cone.position.set(0, -0.02, 0.08);
            entry.mesh.add(cone);
        } else if (slotDirection === 'vertical') {
            // Small cone pointing downward (-Y)
            const coneGeo = new THREE.ConeGeometry(0.03, 0.1, 8);
            coneGeo.rotateX(Math.PI); // point down
            const cone = new THREE.Mesh(coneGeo, indicatorMat);
            cone.name = 'dirIndicator';
            cone.position.set(0, -0.06, 0);
            entry.mesh.add(cone);
        }
    }

    updateOutletPosition(outletId, position3D) {
        const entry = this.outlets.get(outletId);
        if (entry && entry.mesh) {
            entry.mesh.position.copy(position3D);
        }
        if (this.selectedOutletId === outletId && this.selectionRing) {
            this.selectionRing.position.copy(position3D);
            this.selectionRing.position.y -= 0.01;
        }
    }

    removeOutlet(outletId) {
        const entry = this.outlets.get(outletId);
        if (entry) {
            sceneManager.outletsGroup.remove(entry.mesh);
            sceneManager.disposeMesh(entry.mesh);
            this.outlets.delete(outletId);
        }
        if (this.selectedOutletId === outletId) {
            this._clearSelection();
        }
    }

    // ---- Selection ----

    selectOutlet(outletId) {
        this._clearSelection();
        const entry = this.outlets.get(outletId);
        if (!entry) return;

        this.selectedOutletId = outletId;
        const d0 = getType(entry.typeKey)?.sizes[entry.sizeIndex]?.d0 || 0.3;
        const ringGeo = new THREE.RingGeometry(d0 / 2 + 0.08, d0 / 2 + 0.14, 48);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x4a9eff, transparent: true, opacity: 0.7,
            side: THREE.DoubleSide, depthWrite: false
        });
        this.selectionRing = new THREE.Mesh(ringGeo, ringMat);
        this.selectionRing.rotation.x = -Math.PI / 2;
        this.selectionRing.position.copy(entry.mesh.position);
        this.selectionRing.position.y -= 0.01;
        sceneManager.helperGroup.add(this.selectionRing);
    }

    setGridSnap(value) {
        this.gridSnap = value;
    }

    // ---- Mouse Handlers ----

    _onMouseMove(event) {
        // Placement mode: ghost follows cursor
        if (this.placementMode && this.ghostMesh) {
            this._handlePlacementMove(event);
            return;
        }

        // Drag mode: move outlet
        if (this.isDragging && this.dragOutletId) {
            this._handleDragMove(event);
            return;
        }
    }

    _handlePlacementMove(event) {
        const ceilingPlane = roomBuilder.getCeilingPlane();
        if (!ceilingPlane) return;
        const point = sceneManager.raycastToPlane(event, ceilingPlane);
        if (!point) return;

        const snappedX = Math.round(point.x / this.gridSnap) * this.gridSnap;
        const snappedZ = Math.round(point.z / this.gridSnap) * this.gridSnap;

        this.ghostMesh.position.set(snappedX, point.y - 0.02, snappedZ);
        this.ghostIndicator.position.set(snappedX, point.y - 0.005, snappedZ);

        const isInside = roomBuilder.isInsideRoom(snappedX, snappedZ);
        const color = isInside ? 0x4caf50 : 0xf44336;
        this.ghostMesh.material.color.setHex(color);
        this.ghostMesh.material.opacity = isInside ? 0.5 : 0.3;
        this.ghostIndicator.material.color.setHex(color);
    }

    _handleDragMove(event) {
        const ceilingPlane = roomBuilder.getCeilingPlane();
        if (!ceilingPlane) return;
        const point = sceneManager.raycastToPlane(event, ceilingPlane);
        if (!point) return;

        const snappedX = Math.round(point.x / this.gridSnap) * this.gridSnap;
        const snappedZ = Math.round(point.z / this.gridSnap) * this.gridSnap;

        if (!roomBuilder.isInsideRoom(snappedX, snappedZ)) return;

        const entry = this.outlets.get(this.dragOutletId);
        if (entry && entry.mesh) {
            entry.mesh.position.x = snappedX;
            entry.mesh.position.z = snappedZ;
        }

        if (this.selectionRing) {
            this.selectionRing.position.x = snappedX;
            this.selectionRing.position.z = snappedZ;
        }

        // Live update callback
        if (this.onMoved) {
            this.onMoved(this.dragOutletId, snappedX, snappedZ);
        }
    }

    _onMouseDown(event) {
        if (event.button !== 0) return;

        if (this.placementMode) {
            this._handlePlacement(event);
            return;
        }

        // Check if clicking on an outlet for selection/drag
        const outletMeshes = [];
        this.outlets.forEach(entry => outletMeshes.push(entry.mesh));
        if (outletMeshes.length === 0) return;

        const intersects = sceneManager.raycastFromMouse(event, outletMeshes);

        if (intersects.length > 0) {
            let target = intersects[0].object;
            while (target && !target.userData.outletId) {
                target = target.parent;
            }
            if (target && target.userData.outletId) {
                const outletId = target.userData.outletId;

                // Select it
                this.selectOutlet(outletId);
                if (this.onSelected) this.onSelected(outletId);

                // Start drag
                this.isDragging = true;
                this.dragOutletId = outletId;
                this.dragStartPos = target.position.clone();

                // Disable orbit controls during drag
                sceneManager.controls.enabled = false;
                document.getElementById('viewport')?.classList.add('placing');
                return;
            }
        }

        // Clicked nothing: deselect
        if (this.selectedOutletId) {
            this._clearSelection();
            if (this.onDeselected) this.onDeselected();
        }
    }

    _onMouseUp(event) {
        if (this.isDragging) {
            const draggedId = this.dragOutletId;
            this.isDragging = false;
            this.dragOutletId = null;
            this.dragStartPos = null;

            // Re-enable orbit controls
            sceneManager.controls.enabled = true;
            document.getElementById('viewport')?.classList.remove('placing');

            // Notify drag end for undo/redo
            if (this.onDragEnd) this.onDragEnd(draggedId);
        }
    }

    _handlePlacement(event) {
        if (!this.placementData || !this.ghostMesh) return;
        const ceilingPlane = roomBuilder.getCeilingPlane();
        if (!ceilingPlane) return;
        const point = sceneManager.raycastToPlane(event, ceilingPlane);
        if (!point) return;

        const snappedX = Math.round(point.x / this.gridSnap) * this.gridSnap;
        const snappedZ = Math.round(point.z / this.gridSnap) * this.gridSnap;
        if (!roomBuilder.isInsideRoom(snappedX, snappedZ)) return;

        const position3D = new THREE.Vector3(snappedX, point.y, snappedZ);
        const id = 'outlet_' + Date.now();
        const { typeKey, sizeIndex, sizeData, typeData, outletCategory } = this.placementData;

        const mesh = this._createOutletMesh(typeKey, sizeData, false, outletCategory);
        mesh.position.copy(position3D);
        mesh.position.y -= 0.02;
        mesh.userData.outletId = id;
        sceneManager.outletsGroup.add(mesh);

        this.outlets.set(id, { mesh, typeKey, sizeIndex });
        this.cancelPlacement();

        if (this.onPlaced) {
            this.onPlaced({
                id, typeKey, sizeIndex, sizeData, typeData,
                position3D: new THREE.Vector3(snappedX, point.y, snappedZ),
                mounting: 'ceiling',
                volumeFlow: sizeData.vFlowDefault,
                supplyTemp: outletCategory === 'exhaust' ? null : 18,
                rotation: 0,
                slotLength: sizeData.lengthDefault || null,
                slotDirection: typeKey === 'slot' ? 'bidirectional' : null,
                outletCategory: outletCategory || 'supply'
            });
        }
    }

    _onKeyDown(event) {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;

        if (event.key === 'Escape') {
            if (this.placementMode) this.cancelPlacement();
        }

        // R key: rotate selected outlet by 15° (Shift = 45°)
        if (event.key === 'r' || event.key === 'R') {
            if (this.selectedOutletId) {
                const step = event.shiftKey ? Math.PI / 4 : Math.PI / 12; // 45° or 15°
                const entry = this.outlets.get(this.selectedOutletId);
                if (entry && entry.mesh) {
                    entry.mesh.rotation.y += step;
                    if (this.onRotated) {
                        this.onRotated(this.selectedOutletId, entry.mesh.rotation.y);
                    }
                }
            }
        }
    }

    _clearSelection() {
        this.selectedOutletId = null;
        if (this.selectionRing) {
            sceneManager.helperGroup.remove(this.selectionRing);
            sceneManager.disposeMesh(this.selectionRing);
            this.selectionRing = null;
        }
    }

    _createOutletMesh(typeKey, sizeData, isGhost, outletCategory) {
        const d0 = sizeData.d0 || 0.2;
        const isExhaust = outletCategory === 'exhaust';
        let geometry;

        switch (typeKey) {
            case 'swirl':
            case 'exhaustSwirl':
                geometry = new THREE.CylinderGeometry(d0 / 2, d0 / 2, 0.025, 32);
                break;
            case 'plateValve':
            case 'exhaustPlateValve':
                geometry = new THREE.CylinderGeometry(d0 / 2, d0 / 2 * 0.7, 0.035, 24);
                break;
            case 'slot':
            case 'exhaustSlot': {
                const slotLen = (sizeData.lengthDefault || 1000) / 1000;
                const slotW = (sizeData.slotWidth || 0.015) * (sizeData.slotCount || 1) * 3;
                geometry = new THREE.BoxGeometry(slotLen, 0.02, Math.max(slotW, 0.06));
                break;
            }
            case 'nozzle':
                geometry = new THREE.SphereGeometry(d0 / 2, 16, 16);
                break;
            case 'ceilingGrille': {
                const side = d0;
                geometry = new THREE.BoxGeometry(side, 0.02, side);
                break;
            }
            case 'dqjSupply':
            case 'dqjExhaust': {
                // SCHAKO DQJ: round faceplate with visible vane ring
                const outerR = d0 / 2;
                const innerR = outerR * 0.5;
                const ring = new THREE.RingGeometry(innerR, outerR, 32);
                const disk = new THREE.CircleGeometry(innerR, 32);
                // Merge into a cylinder for 3D appearance
                geometry = new THREE.CylinderGeometry(outerR, outerR, 0.03, 32);
                break;
            }
            case 'dqjslcSupply': {
                // SCHAKO DQJSLC: round with outer blowing ring (slightly larger visible diameter)
                const outerR = d0 / 2 * 1.15; // outer ring extends beyond d0
                geometry = new THREE.CylinderGeometry(outerR, outerR, 0.03, 32);
                break;
            }
            default:
                geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16);
        }

        // Exhaust: orange-brown, Supply: blue-grey
        const color = isGhost ? 0x4caf50 : (isExhaust ? 0xcc8844 : 0x6688cc);
        const emissiveColor = isExhaust ? 0x442211 : 0x222244;
        const material = new THREE.MeshStandardMaterial({
            color,
            transparent: isGhost,
            opacity: isGhost ? 0.5 : 0.85,
            roughness: 0.4,
            metalness: 0.3,
            emissive: isGhost ? 0x000000 : emissiveColor,
            emissiveIntensity: 0.3
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = typeKey;
        return mesh;
    }
}

const outletPlacer = new OutletPlacer();
export default outletPlacer;
