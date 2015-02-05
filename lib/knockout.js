var ko = typeof window === 'undefined' || typeof window.ko === 'undefined' ?
    require('knockout') : window.ko;
module.exports = ko;
