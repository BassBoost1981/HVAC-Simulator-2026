// ============================================================
// roomModal — Room creation and welcome modals
// ============================================================

class RoomModal {
    constructor() {
        this.welcomeOverlay = document.getElementById('welcome-modal-overlay');
        this.roomOverlay = document.getElementById('room-modal-overlay');
        this.onCreateRoom = null;
        this.onLoadExample = null;
        this.isFirstRoom = true;
    }

    init(onCreateRoom, onLoadExample, onOpenProject) {
        this.onCreateRoom = onCreateRoom;
        this.onLoadExample = onLoadExample;
        this.onOpenProject = onOpenProject || null;

        // Welcome modal buttons
        document.getElementById('welcome-new')?.addEventListener('click', () => {
            this._hideWelcome();
            this._showRoomModal();
        });

        document.getElementById('welcome-example')?.addEventListener('click', () => {
            this._hideWelcome();
            if (this.onLoadExample) this.onLoadExample();
        });

        document.getElementById('welcome-open')?.addEventListener('click', () => {
            this._hideWelcome();
            if (this.onOpenProject) this.onOpenProject();
        });

        // Room modal buttons
        document.getElementById('room-modal-create')?.addEventListener('click', () => {
            this._handleCreate();
        });

        document.getElementById('room-modal-cancel')?.addEventListener('click', () => {
            this._hideRoomModal();
        });

        // Enter key on inputs
        const inputs = ['room-length', 'room-width', 'room-height', 'room-temp'];
        inputs.forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this._handleCreate();
            });
        });

        // Real-time validation
        inputs.forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => this._validate());
        });
    }

    /**
     * Show the welcome screen on startup
     */
    showWelcome() {
        this.isFirstRoom = true;
        if (this.welcomeOverlay) {
            this.welcomeOverlay.classList.add('active');
        }
    }

    /**
     * Show room creation modal (for "New Room" button)
     */
    showNewRoom() {
        this.isFirstRoom = false;
        const cancelBtn = document.getElementById('room-modal-cancel');
        if (cancelBtn) cancelBtn.style.display = '';
        this._showRoomModal();
    }

    _showRoomModal() {
        if (this.roomOverlay) {
            this.roomOverlay.classList.add('active');
            // Focus first input
            setTimeout(() => {
                document.getElementById('room-length')?.focus();
                document.getElementById('room-length')?.select();
            }, 100);
        }
    }

    _hideWelcome() {
        if (this.welcomeOverlay) {
            this.welcomeOverlay.classList.remove('active');
        }
    }

    _hideRoomModal() {
        if (this.roomOverlay) {
            this.roomOverlay.classList.remove('active');
        }
    }

    _validate() {
        const length = parseFloat(document.getElementById('room-length')?.value);
        const width = parseFloat(document.getElementById('room-width')?.value);
        const height = parseFloat(document.getElementById('room-height')?.value);

        let valid = true;

        // Length
        const fgL = document.getElementById('fg-length');
        if (isNaN(length) || length < 0.5 || length > 50) {
            fgL?.classList.add('has-error');
            valid = false;
        } else {
            fgL?.classList.remove('has-error');
        }

        // Width
        const fgW = document.getElementById('fg-width');
        if (isNaN(width) || width < 0.5 || width > 50) {
            fgW?.classList.add('has-error');
            valid = false;
        } else {
            fgW?.classList.remove('has-error');
        }

        // Height
        const fgH = document.getElementById('fg-height');
        if (isNaN(height) || height < 0.5 || height > 20) {
            fgH?.classList.add('has-error');
            valid = false;
        } else {
            fgH?.classList.remove('has-error');
        }

        // Area check
        if (valid && length * width > 500) {
            fgL?.classList.add('has-error');
            fgW?.classList.add('has-error');
            valid = false;
        }

        const createBtn = document.getElementById('room-modal-create');
        if (createBtn) createBtn.disabled = !valid;

        return valid;
    }

    _handleCreate() {
        if (!this._validate()) return;

        const length = parseFloat(document.getElementById('room-length').value);
        const width = parseFloat(document.getElementById('room-width').value);
        const height = parseFloat(document.getElementById('room-height').value);
        const roomType = document.getElementById('room-type').value;
        const temperature = parseFloat(document.getElementById('room-temp').value);

        // Surface materials
        const surfaces = this._getSurfaces();

        this._hideRoomModal();

        if (this.onCreateRoom) {
            this.onCreateRoom({
                length, width, height, roomType, temperature, surfaces
            });
        }
    }

    _getSurfaces() {
        const ALPHAS = {
            acoustic_tile: 0.85,
            concrete: 0.03,
            plasterboard: 0.08,
            carpet: 0.30,
            glass: 0.12
        };

        const ceilingKey = document.getElementById('surface-ceiling')?.value || 'acoustic_tile';
        const floorKey = document.getElementById('surface-floor')?.value || 'carpet';
        const wallsKey = document.getElementById('surface-walls')?.value || 'concrete';

        return {
            ceiling: { alpha: ALPHAS[ceilingKey] || 0.85, material: ceilingKey },
            floor:   { alpha: ALPHAS[floorKey] || 0.30, material: floorKey },
            wallNS:  { alpha: ALPHAS[wallsKey] || 0.03, material: wallsKey },
            wallEW:  { alpha: ALPHAS[wallsKey] || 0.03, material: wallsKey }
        };
    }
}

const roomModal = new RoomModal();
export default roomModal;
