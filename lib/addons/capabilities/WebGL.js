/**
 * WebGL detection utility for Three.js
 * Based on Three.js r163+ WebGL module
 */

class WebGL {
    static isWebGL2Available() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
        } catch (e) {
            return false;
        }
    }

    static isWebGLAvailable() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    static getWebGL2ErrorMessage() {
        return this.getErrorMessage(2);
    }

    static getWebGLErrorMessage() {
        return this.getErrorMessage(1);
    }

    static getErrorMessage(version) {
        const element = document.createElement('div');
        element.id = 'webgl-error-message';
        element.style.fontFamily = 'monospace';
        element.style.fontSize = '13px';
        element.style.fontWeight = 'normal';
        element.style.textAlign = 'center';
        element.style.background = '#1a1a2e';
        element.style.color = '#e94560';
        element.style.padding = '1.5em';
        element.style.width = '400px';
        element.style.margin = '5em auto 0';
        element.style.borderRadius = '8px';
        element.style.border = '1px solid #e94560';

        const names = {
            1: 'WebGL',
            2: 'WebGL 2'
        };

        const contexts = {
            1: window.WebGLRenderingContext,
            2: window.WebGL2RenderingContext
        };

        if (!contexts[version]) {
            element.innerHTML = `Your browser does not support <strong>${names[version]}</strong>.<br>` +
                'Please update your browser or try a different one.';
        } else {
            element.innerHTML = `Your graphics card does not seem to support <strong>${names[version]}</strong>.<br>` +
                'Please check if your drivers are up to date or try a different browser.';
        }

        return element;
    }
}

export default WebGL;
