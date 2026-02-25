// ============================================================
// undoRedo — Undo/Redo history for outlet operations
// ============================================================

const MAX_HISTORY = 50;

class UndoRedo {
    constructor() {
        this._undoStack = [];
        this._redoStack = [];
        this._onChangeCallbacks = [];
    }

    /**
     * Register a callback that fires when undo/redo availability changes
     */
    onChange(fn) {
        this._onChangeCallbacks.push(fn);
    }

    /**
     * Push an action onto the undo stack. Clears the redo stack.
     * @param {Object} action - { type: 'add'|'remove'|'modify', outletId, before?, after? }
     */
    push(action) {
        this._undoStack.push(action);
        if (this._undoStack.length > MAX_HISTORY) {
            this._undoStack.shift();
        }
        this._redoStack.length = 0;
        this._notify();
    }

    canUndo() {
        return this._undoStack.length > 0;
    }

    canRedo() {
        return this._redoStack.length > 0;
    }

    /**
     * Pop the last action and return it for the caller to apply the undo.
     * @returns {Object|null} The action to undo
     */
    undo() {
        if (this._undoStack.length === 0) return null;
        const action = this._undoStack.pop();
        this._redoStack.push(action);
        this._notify();
        return action;
    }

    /**
     * Pop from the redo stack and return it for the caller to apply.
     * @returns {Object|null} The action to redo
     */
    redo() {
        if (this._redoStack.length === 0) return null;
        const action = this._redoStack.pop();
        this._undoStack.push(action);
        this._notify();
        return action;
    }

    /**
     * Clear all history (e.g., on new room)
     */
    clear() {
        this._undoStack.length = 0;
        this._redoStack.length = 0;
        this._notify();
    }

    _notify() {
        const canUndo = this.canUndo();
        const canRedo = this.canRedo();
        for (const fn of this._onChangeCallbacks) {
            fn(canUndo, canRedo);
        }
    }
}

const undoRedo = new UndoRedo();
export default undoRedo;

/**
 * Create a plain snapshot of outlet data (no Three.js objects, no functions).
 * Used to store before/after state for undo/redo.
 */
export function snapshotOutlet(outlet) {
    return {
        id: outlet.id,
        typeKey: outlet.typeKey,
        sizeIndex: outlet.sizeIndex,
        mounting: outlet.mounting,
        volumeFlow: outlet.volumeFlow,
        supplyTemp: outlet.supplyTemp,
        rotation: outlet.rotation,
        slotLength: outlet.slotLength,
        slotDirection: outlet.slotDirection,
        outletCategory: outlet.outletCategory,
        position3D: {
            x: outlet.position3D.x,
            y: outlet.position3D.y,
            z: outlet.position3D.z
        }
    };
}
