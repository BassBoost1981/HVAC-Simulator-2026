// ============================================================
// comparisonRenderer.js — Split-Screen comparison mode
// Vergleichsmodus: Zwei Viewports nebeneinander
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import sceneManager from './sceneManager.js';

class ComparisonRenderer {
    constructor() {
        this.active = false;
        this.renderer = null;
        this.camera = null;
        this.controls = null;
        this.scene = null;
        this.canvas = null;

        // Scene groups for Config B
        this.roomGroup = null;
        this.outletsGroup = null;
        this.visualizationGroup = null;

        this.syncCamera = true;
        this._resizeObserver = null;
        this._animFrameId = null;
    }

    /**
     * Activate comparison mode
     * Vergleichsmodus aktivieren
     */
    activate() {
        if (this.active) return;

        const container = document.getElementById('viewport-b');
        this.canvas = document.getElementById('viewport-b-canvas');
        if (!container || !this.canvas) return;

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setClearColor(0x1a1a2e, 1);

        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);

        // Lighting (same as main scene)
        this.scene.add(new THREE.AmbientLight(0x404060, 0.7));
        const dir = new THREE.DirectionalLight(0xffffff, 0.9);
        dir.position.set(10, 20, 10);
        this.scene.add(dir);
        const fill = new THREE.DirectionalLight(0x4466aa, 0.3);
        fill.position.set(-5, 5, -5);
        this.scene.add(fill);

        // Camera (clone from main)
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
        this.camera.position.copy(sceneManager.camera.position);
        this.camera.quaternion.copy(sceneManager.camera.quaternion);

        // Controls
        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.minDistance = 0.5;
        this.controls.maxDistance = 100;
        this.controls.maxPolarAngle = Math.PI * 0.95;
        this.controls.target.copy(sceneManager.controls.target);
        this.controls.update();

        // Scene groups
        this.roomGroup = new THREE.Group();
        this.roomGroup.name = 'RoomGroupB';
        this.scene.add(this.roomGroup);

        this.outletsGroup = new THREE.Group();
        this.outletsGroup.name = 'OutletsGroupB';
        this.scene.add(this.outletsGroup);

        this.visualizationGroup = new THREE.Group();
        this.visualizationGroup.name = 'VisualizationGroupB';
        this.scene.add(this.visualizationGroup);

        // Clone room geometry from main scene
        this._cloneRoomGeometry();

        // Resize handling
        this._resizeObserver = new ResizeObserver(() => this._resize(container));
        this._resizeObserver.observe(container);
        this._resize(container);

        // Mark active BEFORE starting render loop
        this.active = true;

        // Toggle CSS class
        document.getElementById('app')?.classList.add('comparison-mode');

        // Render loop: sync camera + render
        this._animFrameId = null;
        const renderLoop = () => {
            if (!this.active) return;

            // Sync camera from main scene if enabled
            if (this.syncCamera) {
                this.camera.position.copy(sceneManager.camera.position);
                this.camera.quaternion.copy(sceneManager.camera.quaternion);
                this.controls.target.copy(sceneManager.controls.target);
                this.controls.update();
            } else {
                this.controls.update();
            }

            this.renderer.render(this.scene, this.camera);
            this._animFrameId = requestAnimationFrame(renderLoop);
        };
        this._animFrameId = requestAnimationFrame(renderLoop);
    }

    /**
     * Deactivate comparison mode
     * Vergleichsmodus deaktivieren
     */
    deactivate() {
        if (!this.active) return;

        // Stop render loop
        if (this._animFrameId) {
            cancelAnimationFrame(this._animFrameId);
            this._animFrameId = null;
        }

        // Cleanup resize observer
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }

        // Dispose scene
        if (this.scene) {
            this.scene.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else if (obj.material.dispose) {
                        obj.material.dispose();
                    }
                }
            });
        }

        // Dispose renderer
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }

        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }

        this.scene = null;
        this.camera = null;
        this.roomGroup = null;
        this.outletsGroup = null;
        this.visualizationGroup = null;
        this.active = false;

        document.getElementById('app')?.classList.remove('comparison-mode');
    }

    /**
     * Toggle comparison mode on/off
     */
    toggle() {
        if (this.active) {
            this.deactivate();
        } else {
            this.activate();
        }
        return this.active;
    }

    /**
     * Clone room geometry from main scene to comparison scene
     * Raumgeometrie von Hauptszene klonen
     */
    _cloneRoomGeometry() {
        if (!this.roomGroup) return;

        // Clear existing
        while (this.roomGroup.children.length > 0) {
            this.roomGroup.remove(this.roomGroup.children[0]);
        }

        // Clone all meshes from main room group
        sceneManager.roomGroup.traverse(child => {
            if (child.isMesh || child.isLineSegments) {
                const clone = child.clone();
                // Clone materials too (so color changes don't affect both)
                if (clone.material) {
                    clone.material = clone.material.clone();
                }
                this.roomGroup.add(clone);
            }
        });
    }

    /**
     * Clone outlets from a state configuration
     * Auslässe aus einer Konfiguration klonen
     */
    cloneOutlets(outlets) {
        if (!this.outletsGroup) return;

        // Clear existing
        while (this.outletsGroup.children.length > 0) {
            const child = this.outletsGroup.children[0];
            this.outletsGroup.remove(child);
        }

        // Clone outlet meshes from main scene
        sceneManager.outletsGroup.traverse(child => {
            if (child.userData && child.userData.outletId) {
                const clone = child.clone(true); // deep clone
                this.outletsGroup.add(clone);
            }
        });
    }

    /**
     * Update room if it changes
     */
    updateRoom() {
        if (this.active) {
            this._cloneRoomGeometry();
        }
    }

    _resize(container) {
        if (!this.renderer || !this.camera) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w === 0 || h === 0) return;

        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
    }
}

const comparisonRenderer = new ComparisonRenderer();
export default comparisonRenderer;
