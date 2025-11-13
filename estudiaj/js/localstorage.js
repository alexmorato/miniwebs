// localstorage.js
// Centraliza los nombres de las variables usadas en localStorage para evitar errores de escritura y facilitar cambios globales.

export const LS_KEYS = {
    LAST_VISIT: 'stdj_lastVisit',
    USER: 'stdj_user',
    TOKEN: 'stdj_token',
    WORDWALL_URL: 'stdj_wordwallUrl',
    // Agrega aquí más claves según las uses en la app
};

// Ejemplo de uso:
// import { LS_KEYS } from './localstorage.js';
// localStorage.setItem(LS_KEYS.LAST_VISIT, new Date().toISOString());
// const user = localStorage.getItem(LS_KEYS.USER);
