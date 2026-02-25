// ============================================================
// i18n — Lightweight translation module
// ============================================================

let translations = {};
let currentLang = 'de';
const listeners = [];

export async function initI18n(lang = 'de') {
    currentLang = lang;
    try {
        const response = await fetch(`./assets/locales/${lang}.json`);
        translations = await response.json();
    } catch (e) {
        console.warn(`[i18n] Could not load locale "${lang}", falling back to keys.`);
        translations = {};
    }
}

export function t(key, params = {}) {
    let str = translations[key] || key;
    for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, v);
    }
    return str;
}

export function getLang() {
    return currentLang;
}

export async function setLanguage(lang) {
    await initI18n(lang);
    // Update all DOM elements with data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    listeners.forEach(fn => fn(lang));
}

export function onLanguageChange(fn) {
    listeners.push(fn);
}
