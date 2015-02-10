(function (root, factory) {
    if (typeof exports === 'object') {
        module.exports = factory(require('knockout'),
            require('./map'), require('./filter'),
            require('./sortBy'), require('./indexBy'));
    } else if (typeof define === 'function' && define.amd) {
        define(['knockout', './map', './filter', './sortBy', './indexBy'], factory);
    } else {
        var ko = root.ko;
        factory(
            ko,
            ko.transformations.fn.map,
            ko.transformations.fn.filter,
            ko.transformations.fn.sortBy,
            ko.transformations.fn.indexBy
        );
    }
}(this, function (ko, map, filter, sortBy, indexBy) {
    return ko.transformations.fn;
}));
