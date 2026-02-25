// ============================================================
// roomBuilder — Creates and manages the 3D room geometry
// ============================================================

import * as THREE from 'three';
import sceneManager from './sceneManager.js';

class RoomBuilder {
    constructor() {
        this.roomData = null;
        this.ceilingPlane = null; // Invisible plane for raycasting
    }

    /**
     * Build a 3D room from dimensions
     * Room is centered at origin: X = length, Y = height (up), Z = width
     */
    buildRoom(length, width, height) {
        // Clear existing room
        sceneManager.clearGroup(sceneManager.roomGroup);

        this.roomData = { length, width, height };

        const halfL = length / 2;
        const halfW = width / 2;

        // ---- Floor (opaque) ----
        const floorGeo = new THREE.PlaneGeometry(length, width);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a3a,
            roughness: 0.9,
            metalness: 0.0,
            side: THREE.DoubleSide
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.name = 'floor';
        sceneManager.roomGroup.add(floor);

        // ---- Floor grid ----
        this._createGrid(length, width, 0.002, 0.5, 0x3a3a5a);

        // ---- Walls (semi-transparent) ----
        const wallMat = new THREE.MeshBasicMaterial({
            color: 0x8888cc,
            transparent: true,
            opacity: 0.06,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        // Wall North (Z = +halfW)
        const wallNGeo = new THREE.PlaneGeometry(length, height);
        const wallN = new THREE.Mesh(wallNGeo, wallMat.clone());
        wallN.position.set(0, height / 2, halfW);
        wallN.name = 'wallN';
        sceneManager.roomGroup.add(wallN);

        // Wall South (Z = -halfW)
        const wallS = new THREE.Mesh(wallNGeo.clone(), wallMat.clone());
        wallS.position.set(0, height / 2, -halfW);
        wallS.rotation.y = Math.PI;
        wallS.name = 'wallS';
        sceneManager.roomGroup.add(wallS);

        // Wall East (X = +halfL)
        const wallEGeo = new THREE.PlaneGeometry(width, height);
        const wallE = new THREE.Mesh(wallEGeo, wallMat.clone());
        wallE.position.set(halfL, height / 2, 0);
        wallE.rotation.y = -Math.PI / 2;
        wallE.name = 'wallE';
        sceneManager.roomGroup.add(wallE);

        // Wall West (X = -halfL)
        const wallW = new THREE.Mesh(wallEGeo.clone(), wallMat.clone());
        wallW.position.set(-halfL, height / 2, 0);
        wallW.rotation.y = Math.PI / 2;
        wallW.name = 'wallW';
        sceneManager.roomGroup.add(wallW);

        // ---- Wireframe edges ----
        const edgeGeo = new THREE.BoxGeometry(length, height, width);
        const edges = new THREE.EdgesGeometry(edgeGeo);
        const edgeMat = new THREE.LineBasicMaterial({ color: 0x5a5a8a, linewidth: 1 });
        const edgeLines = new THREE.LineSegments(edges, edgeMat);
        edgeLines.position.y = height / 2;
        edgeLines.name = 'roomEdges';
        sceneManager.roomGroup.add(edgeLines);

        // ---- Ceiling grid (subtle) ----
        this._createGrid(length, width, height - 0.001, 1.0, 0x33335a);

        // ---- Dimension labels ----
        this._createDimensionLabel(`${length.toFixed(1)} m`, halfL, 0, 0, 'x', length);
        this._createDimensionLabel(`${width.toFixed(1)} m`, 0, 0, halfW, 'z', width);
        this._createDimensionLabel(`${height.toFixed(1)} m`, halfL, height / 2, halfW, 'y', height);

        // ---- Occupied zone indicator (subtle floor area at 1.2m) ----
        const ozGeo = new THREE.PlaneGeometry(
            Math.max(0, length - 1.0),
            Math.max(0, width - 1.0)
        );
        const ozMat = new THREE.MeshBasicMaterial({
            color: 0x4caf50,
            transparent: true,
            opacity: 0.03,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const ozPlane = new THREE.Mesh(ozGeo, ozMat);
        ozPlane.rotation.x = -Math.PI / 2;
        ozPlane.position.y = 1.2;
        ozPlane.name = 'occupiedZone';
        sceneManager.roomGroup.add(ozPlane);

        // ---- Invisible ceiling plane for raycasting ----
        this.ceilingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), height);

        // Set camera to view the room
        sceneManager.setCameraForRoom(length, width, height);
    }

    /**
     * Create a grid on a horizontal plane
     */
    _createGrid(length, width, yPos, spacing, color) {
        const halfL = length / 2;
        const halfW = width / 2;
        const points = [];

        // Lines along X (varying Z)
        const numZ = Math.floor(width / spacing) + 1;
        for (let i = 0; i <= numZ; i++) {
            const z = -halfW + i * spacing;
            if (z > halfW + 0.001) break;
            points.push(new THREE.Vector3(-halfL, yPos, z));
            points.push(new THREE.Vector3(halfL, yPos, z));
        }

        // Lines along Z (varying X)
        const numX = Math.floor(length / spacing) + 1;
        for (let i = 0; i <= numX; i++) {
            const x = -halfL + i * spacing;
            if (x > halfL + 0.001) break;
            points.push(new THREE.Vector3(x, yPos, -halfW));
            points.push(new THREE.Vector3(x, yPos, halfW));
        }

        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.4
        });
        const grid = new THREE.LineSegments(geo, mat);
        grid.name = `grid_${yPos}`;
        sceneManager.roomGroup.add(grid);
    }

    /**
     * Create a simple sprite-based dimension label
     */
    _createDimensionLabel(text, x, y, z, axis) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 40;

        // Rounded rect helper (compatible with older browsers)
        const drawRoundedRect = (cx, x, y, w, h, r) => {
            cx.beginPath();
            cx.moveTo(x + r, y);
            cx.lineTo(x + w - r, y);
            cx.quadraticCurveTo(x + w, y, x + w, y + r);
            cx.lineTo(x + w, y + h - r);
            cx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            cx.lineTo(x + r, y + h);
            cx.quadraticCurveTo(x, y + h, x, y + h - r);
            cx.lineTo(x, y + r);
            cx.quadraticCurveTo(x, y, x + r, y);
            cx.closePath();
        };

        ctx.fillStyle = 'rgba(10, 10, 26, 0.7)';
        drawRoundedRect(ctx, 0, 0, 128, 40, 6);
        ctx.fill();

        ctx.strokeStyle = 'rgba(90, 90, 138, 0.5)';
        ctx.lineWidth = 1;
        drawRoundedRect(ctx, 0, 0, 128, 40, 6);
        ctx.stroke();

        ctx.fillStyle = '#a0a0c0';
        ctx.font = '500 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 64, 21);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;

        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            depthTest: false
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(1.2, 0.4, 1);

        // Position based on axis
        if (axis === 'x') {
            sprite.position.set(0, -0.15, z + 0.5);
        } else if (axis === 'z') {
            sprite.position.set(x + 0.5, -0.15, 0);
        } else {
            sprite.position.set(x + 0.3, y, z + 0.3);
        }

        sprite.name = `label_${axis}`;
        sceneManager.roomGroup.add(sprite);
    }

    getRoom() {
        return this.roomData;
    }

    getCeilingPlane() {
        return this.ceilingPlane;
    }

    /**
     * Check if a point (x, z) is inside the room bounds
     */
    isInsideRoom(x, z) {
        if (!this.roomData) return false;
        const halfL = this.roomData.length / 2;
        const halfW = this.roomData.width / 2;
        const margin = 0.05;
        return x >= -halfL + margin && x <= halfL - margin &&
               z >= -halfW + margin && z <= halfW - margin;
    }
}

const roomBuilder = new RoomBuilder();
export default roomBuilder;
