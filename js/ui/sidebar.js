// ============================================================
// sidebar — Outlet library panel (left side)
// ============================================================

import { getAllTypes, getAllExhaustTypes } from '../simulation/diffuserDB.js';

// SVG icons for each outlet type (inline, no external files)
const ICONS = {
    swirl: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" stroke-dasharray="4 2"/><path d="M12 4 A8 8 0 0 1 20 12"/><path d="M12 8 A4 4 0 0 1 16 12"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>`,
    plateValve: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="5" ry="2"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
    slot: `<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="2" rx="1"/><rect x="3" y="13" width="18" height="2" rx="1"/><line x1="2" y1="6" x2="6" y2="9"/><line x1="22" y1="6" x2="18" y2="9"/><line x1="2" y1="18" x2="6" y2="15"/><line x1="22" y1="18" x2="18" y2="15"/></svg>`,
    nozzle: `<svg viewBox="0 0 24 24"><circle cx="8" cy="12" r="4"/><line x1="12" y1="12" x2="22" y2="12"/><polyline points="19,9 22,12 19,15"/><circle cx="8" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>`,
    ceilingGrille: `<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/><polyline points="12,18 12,12" stroke-width="1.5"/><polyline points="10,14 12,12 14,14" stroke-width="1.5"/></svg>`,
    exhaustSwirl: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" stroke-dasharray="4 2"/><path d="M12 4 A8 8 0 0 1 20 12"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><polyline points="12,18 12,13" stroke-width="1.5"/><polyline points="10,15 12,13 14,15" stroke-width="1.5"/></svg>`,
    exhaustPlateValve: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="5" ry="2"/><polyline points="12,18 12,13" stroke-width="1.5"/><polyline points="10,15 12,13 14,15" stroke-width="1.5"/></svg>`,
    exhaustSlot: `<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="2" rx="1"/><rect x="3" y="13" width="18" height="2" rx="1"/><polyline points="12,18 12,13" stroke-width="1.5"/><polyline points="10,15 12,13 14,15" stroke-width="1.5"/></svg>`,
    // SCHAKO DQJ-R-SR (round faceplate swirl diffuser)
    dqjSupply: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-width="1.5"/><circle cx="12" cy="12" r="5" stroke-dasharray="3 2"/><path d="M12 3 A9 9 0 0 1 21 12" stroke-width="1.2"/><path d="M12 7 A5 5 0 0 1 17 12" stroke-width="1.2"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><text x="12" y="22" text-anchor="middle" font-size="4" fill="currentColor" stroke="none">DQJ</text></svg>`,
    dqjExhaust: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-width="1.5"/><circle cx="12" cy="12" r="5" stroke-dasharray="3 2"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><polyline points="12,18 12,13" stroke-width="1.5"/><polyline points="10,15 12,13 14,15" stroke-width="1.5"/><text x="12" y="22" text-anchor="middle" font-size="4" fill="currentColor" stroke="none">DQJ</text></svg>`,
    // SCHAKO DQJSLC (swirl with outer blowing ring)
    dqjslcSupply: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-width="1.5"/><circle cx="12" cy="12" r="7" stroke-width="0.8" stroke-dasharray="1 1"/><circle cx="12" cy="12" r="4" stroke-dasharray="3 2"/><path d="M12 3 A9 9 0 0 1 21 12" stroke-width="1"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><text x="12" y="22" text-anchor="middle" font-size="3.5" fill="currentColor" stroke="none">SLC</text></svg>`
};

class Sidebar {
    constructor() {
        this.container = document.getElementById('sidebar-content');
        this.activeItem = null;
        this.onSelectCallback = null;
    }

    init(onSelect) {
        this.onSelectCallback = onSelect;
        this._render();
    }

    _render() {
        this.container.innerHTML = '';

        // --- Supply section ---
        this._renderSectionHeader('Zuluft', 'supply');
        const supplyTypes = getAllTypes();
        supplyTypes.forEach(type => {
            this._renderOutletGroup(type, 'supply');
        });

        // --- Exhaust section ---
        this._renderSectionHeader('Abluft', 'exhaust');
        const exhaustTypes = getAllExhaustTypes();
        exhaustTypes.forEach(type => {
            this._renderOutletGroup(type, 'exhaust');
        });
    }

    _renderSectionHeader(label, category) {
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'sidebar-section-header';
        sectionHeader.dataset.category = category;
        const color = category === 'exhaust' ? '#cc8844' : '#6688cc';
        sectionHeader.innerHTML = `<span style="color:${color}; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">${label}</span>`;
        this.container.appendChild(sectionHeader);
    }

    _renderOutletGroup(type, category) {
        const group = document.createElement('div');
        group.className = 'outlet-group';

        const header = document.createElement('div');
        header.className = 'outlet-group-header';
        header.innerHTML = `
            <span class="outlet-icon">${ICONS[type.key] || ''}</span>
            <span>${type.nameDE}</span>
        `;

        const sizesDiv = document.createElement('div');
        sizesDiv.className = 'outlet-sizes';

        type.sizes.forEach((size, sizeIndex) => {
            const item = document.createElement('div');
            item.className = 'outlet-size-item';
            item.dataset.typeKey = type.key;
            item.dataset.sizeIndex = sizeIndex;
            item.dataset.category = category;

            const flowRange = `${size.vFlowRange[0]}–${size.vFlowRange[1]}`;
            item.innerHTML = `
                <span class="size-name">${size.name}</span>
                <span class="size-flow">${flowRange} m³/h</span>
            `;

            item.addEventListener('click', () => this._onItemClick(type.key, sizeIndex, item, category));
            sizesDiv.appendChild(item);
        });

        header.addEventListener('click', () => {
            sizesDiv.style.display = sizesDiv.style.display === 'none' ? '' : 'none';
        });

        group.appendChild(header);
        group.appendChild(sizesDiv);
        this.container.appendChild(group);
    }

    _onItemClick(typeKey, sizeIndex, element, outletCategory) {
        // Remove previous active
        if (this.activeItem) {
            this.activeItem.classList.remove('active');
        }

        // Set new active
        this.activeItem = element;
        element.classList.add('active');

        if (this.onSelectCallback) {
            this.onSelectCallback(typeKey, sizeIndex, outletCategory || 'supply');
        }
    }

    /**
     * Clear the active selection (e.g., after placement or cancel)
     */
    clearSelection() {
        if (this.activeItem) {
            this.activeItem.classList.remove('active');
            this.activeItem = null;
        }
    }
}

const sidebar = new Sidebar();
export default sidebar;
