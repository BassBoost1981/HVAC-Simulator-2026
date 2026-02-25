// ============================================================
// toolbar — Bottom toolbar and status bar
// ============================================================

class Toolbar {
    constructor() {
        this.onViewChange = null;
        this.onGridChange = null;
        this.onVisToggle = null;
        this.onNewRoom = null;
    }

    init({ onViewChange, onGridChange, onVisToggle, onNewRoom }) {
        this.onViewChange = onViewChange;
        this.onGridChange = onGridChange;
        this.onVisToggle = onVisToggle;
        this.onNewRoom = onNewRoom;

        // Camera presets
        document.getElementById('btn-view-perspective')?.addEventListener('click', () => onViewChange('perspective'));
        document.getElementById('btn-view-top')?.addEventListener('click', () => onViewChange('top'));
        document.getElementById('btn-view-front')?.addEventListener('click', () => onViewChange('front'));
        document.getElementById('btn-view-side')?.addEventListener('click', () => onViewChange('side'));

        // Grid snap
        document.getElementById('grid-snap-select')?.addEventListener('change', (e) => {
            onGridChange(parseFloat(e.target.value));
        });

        // Visualization toggles
        const btnCone = document.getElementById('btn-vis-cone');
        if (btnCone) {
            btnCone.addEventListener('click', () => {
                btnCone.classList.toggle('active');
                onVisToggle('cone', btnCone.classList.contains('active'));
            });
        }

        // New room button
        document.getElementById('btn-new-room')?.addEventListener('click', () => onNewRoom());
    }

    /**
     * Update status bar info
     */
    updateStatus(outletCount, calcTimeMs) {
        const statusOutlets = document.getElementById('status-outlets');
        const statusCalc = document.getElementById('status-calc');

        if (statusOutlets) {
            statusOutlets.textContent = `${outletCount} ${outletCount === 1 ? 'Auslass' : 'Auslässe'}`;
        }
        if (statusCalc) {
            statusCalc.textContent = `Berechnung: ${calcTimeMs != null ? calcTimeMs.toFixed(1) + ' ms' : '—'}`;
        }
    }

    /**
     * Update volume flow balance display
     * @param {Object|null} balance - { supplyTotal, exhaustTotal, diffPercent }
     */
    updateBalance(balance) {
        const el = document.getElementById('status-balance');
        if (!el) return;

        if (!balance) {
            el.textContent = '';
            el.title = '';
            el.className = 'status-item status-balance';
            return;
        }

        const { supplyTotal, exhaustTotal, diffPercent } = balance;

        if (exhaustTotal === 0 && supplyTotal === 0) {
            el.textContent = '';
            return;
        }

        const supplyStr = Math.round(supplyTotal);
        const exhaustStr = Math.round(exhaustTotal);
        el.textContent = `\u2191 ${supplyStr} / \u2193 ${exhaustStr} m\u00B3/h`;

        // Warning styling
        if (exhaustTotal === 0) {
            el.className = 'status-item status-balance';
            el.title = 'Keine Abluft platziert';
        } else if (diffPercent > 10) {
            el.className = 'status-item status-balance status-balance-red';
            el.title = `Volumenstrom-Differenz ${diffPercent.toFixed(0)}% — starker \u00DCber-/Unterdruck`;
        } else if (diffPercent > 5) {
            el.className = 'status-item status-balance status-balance-yellow';
            el.title = `Volumenstrom-Differenz ${diffPercent.toFixed(0)}%`;
        } else {
            el.className = 'status-item status-balance status-balance-green';
            el.title = `Bilanz ausgeglichen (${diffPercent.toFixed(0)}%)`;
        }
    }
}

const toolbar = new Toolbar();
export default toolbar;
