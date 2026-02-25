// ============================================================
// sceneManager — Three.js scene lifecycle and utilities
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class SceneManager {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.canvas = null;
        this.updateCallbacks = [];
        this._resizeObserver = null;
    }

    init() {
        this.canvas = document.getElementById('viewport-canvas');
        const container = document.getElementById('viewport');

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setClearColor(0x1a1a2e, 1);
        this.renderer.shadowMap.enabled = false;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);

        // Camera
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
        this.camera.position.set(12, 9, 12);
        this.camera.lookAt(0, 1.5, 0);

        // Lighting
        const ambient = new THREE.AmbientLight(0x404060, 0.7);
        this.scene.add(ambient);

        const directional = new THREE.DirectionalLight(0xffffff, 0.9);
        directional.position.set(10, 20, 10);
        this.scene.add(directional);

        const fill = new THREE.DirectionalLight(0x4466aa, 0.3);
        fill.position.set(-5, 5, -5);
        this.scene.add(fill);

        // OrbitControls
        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.minDistance = 0.5;
        this.controls.maxDistance = 100;
        this.controls.maxPolarAngle = Math.PI * 0.95;
        this.controls.target.set(0, 1.5, 0);
        this.controls.update();

        // Scene groups (fixed structure)
        this.roomGroup = new THREE.Group();
        this.roomGroup.name = 'RoomGroup';
        this.scene.add(this.roomGroup);

        this.outletsGroup = new THREE.Group();
        this.outletsGroup.name = 'OutletsGroup';
        this.scene.add(this.outletsGroup);

        this.visualizationGroup = new THREE.Group();
        this.visualizationGroup.name = 'VisualizationGroup';
        this.scene.add(this.visualizationGroup);

        this.helperGroup = new THREE.Group();
        this.helperGroup.name = 'HelperGroup';
        this.scene.add(this.helperGroup);

        // Resize handling
        this._handleResize(container);

        // Initial size
        this._resize(container);

        // Render loop
        this.renderer.setAnimationLoop(() => this._render());
    }

    _render() {
        this.controls.update();
        for (const cb of this.updateCallbacks) {
            cb();
        }
        this.renderer.render(this.scene, this.camera);
    }

    _handleResize(container) {
        this._resizeObserver = new ResizeObserver(() => {
            this._resize(container);
        });
        this._resizeObserver.observe(container);
    }

    _resize(container) {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w === 0 || h === 0) return;

        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
    }

    /**
     * Register a callback to run every frame
     */
    onUpdate(callback) {
        this.updateCallbacks.push(callback);
    }

    /**
     * Raycast from mouse event against given objects
     */
    raycastFromMouse(event, targets) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        return this.raycaster.intersectObjects(targets, true);
    }

    /**
     * Raycast from mouse against a THREE.Plane
     */
    raycastToPlane(event, plane) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const target = new THREE.Vector3();
        const hit = this.raycaster.ray.intersectPlane(plane, target);
        return hit ? target : null;
    }

    // ---- Camera Presets ----

    setCameraForRoom(length, width, height) {
        const maxDim = Math.max(length, width, height);
        const dist = maxDim * 1.8;
        this.camera.position.set(dist * 0.8, dist * 0.6, dist * 0.8);
        this.controls.target.set(0, height * 0.4, 0);
        this.controls.update();
    }

    setPerspective(length, width, height) {
        const maxDim = Math.max(length, width, height);
        const dist = maxDim * 1.8;
        this.camera.position.set(dist * 0.8, dist * 0.6, dist * 0.8);
        this.controls.target.set(0, height * 0.4, 0);
        this.controls.update();
    }

    setTopDown(length, width, height) {
        const maxDim = Math.max(length, width) * 0.8;
        this.camera.position.set(0, maxDim * 2, 0.01);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    setFront(length, width, height) {
        const maxDim = Math.max(length, height);
        this.camera.position.set(0, height * 0.5, maxDim * 2);
        this.controls.target.set(0, height * 0.5, 0);
        this.controls.update();
    }

    setSide(length, width, height) {
        const maxDim = Math.max(width, height);
        this.camera.position.set(maxDim * 2, height * 0.5, 0);
        this.controls.target.set(0, height * 0.5, 0);
        this.controls.update();
    }

    /**
     * Dispose a mesh and its geometry/material
     */
    disposeMesh(mesh) {
        if (!mesh) return;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => m.dispose());
            } else {
                mesh.material.dispose();
            }
        }
    }

    /**
     * Clear all children from a group, disposing resources
     */
    clearGroup(group) {
        while (group.children.length > 0) {
            const child = group.children[0];
            group.remove(child);
            if (child.traverse) {
                child.traverse(obj => {
                    if (obj.isMesh) this.disposeMesh(obj);
                    if (obj.isLine) this.disposeMesh(obj);
                });
            }
        }
    }
}

// Singleton export
const sceneManager = new SceneManager();
export default sceneManager;
