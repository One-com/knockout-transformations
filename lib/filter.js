var ko = require('./knockout');
var namespace = require('./namespace.js');
require('./map.js');

ko.observable.fn.filter = namespace.fn.filter = function filter(mappingOptions) {
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

    return namespace.fn.map.call(this, mappingOptions);
};
