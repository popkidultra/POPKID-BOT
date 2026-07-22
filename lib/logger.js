'use strict';

// Tiny console-backed logger so lib/sessionLoader.js has something to
// require('./logger') without pulling in a full logging framework.
module.exports = {
    info: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
};
