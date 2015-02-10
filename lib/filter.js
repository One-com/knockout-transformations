(function (root, factory) {
    if (typeof exports === 'object') {
        module.exports = factory(require('knockout'), require('./map'));
    } else if (typeof define === 'function' && define.amd) {
        define(['knockout', './map'], factory);
    } else {
        var ko = root.ko;
        factory(ko, ko.transformations.fn.map);
    }
}(this, function (ko, map) {
    ko.observable.fn.filter = ko.transformations.fn.filter = function filter(mappingOptions) {
        // Shorthand syntax - just pass a function instead of an options object
        if (typeof mappingOptions === 'function') {
            mappingOptions = { mapping: mappingOptions };
        }
        var predicate = mappingOptions.mapping;

        var exclusionMarker = {};
        mappingOptions.mapping = function (item) {
            return predicate(item) ? item : exclusionMarker;
        };
        mappingOptions.exclusionMarker = exclusionMarker;

        return map.call(this, mappingOptions);
    };
    return ko.transformations.fn.filter;
}));
