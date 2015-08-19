(function (root, factory) {
    if (typeof exports === 'object') {
        module.exports = factory(require('knockout'));
    } else if (typeof define === 'function' && define.amd) {
        define(['knockout'], factory);
    } else {
        factory(root.ko);
    }
}(this, function (ko) {
    ko.transformations = ko.transformations || {
        fn: {}
    };

    function sortingKeysEquals(aSortKeys, bSortKeys) {
        var Descending = SortByTransformation.Descending;
        if (!Array.isArray(aSortKeys)) {
            aSortKeys = [aSortKeys];
            bSortKeys = [bSortKeys];
        }

        var aSortKey, bSortKey;

        for (var i = 0; i < aSortKeys.length; i += 1) {
            aSortKey = aSortKeys[i];
            bSortKey = bSortKeys[i];
            if (aSortKey instanceof Descending) {
                if (bSortKey instanceof Descending) {
                    aSortKey = aSortKey.value;
                    bSortKey = bSortKey.value;
                } else {
                    return false;
                }
            }

            if (aSortKey !== bSortKey) {
                return false;
            }
        }

        return true;
    }

    function compareSortingKeys(aSortKeys, bSortKeys, comparator) {
        var Descending = SortByTransformation.Descending;
        if (!Array.isArray(aSortKeys)) {
            aSortKeys = [aSortKeys];
            bSortKeys = [bSortKeys];
        }

        var aSortKey, bSortKey, comparison;

        for (var i = 0; i < aSortKeys.length; i += 1) {
            aSortKey = aSortKeys[i];
            bSortKey = bSortKeys[i];
            if (aSortKey instanceof Descending) {
                comparison = comparator(bSortKey.value, aSortKey.value);
            } else {
                comparison = comparator(aSortKey, bSortKey);
            }
            if (comparison !== 0) {
                return comparison;
            }
        }
        return 0;
    }

    // Sorting
    function mappingToComparefn(mapping, comparator) {
        var Descending = SortByTransformation.Descending;
        return function (a, b) {
            var aSortKeys = mapping(a, Descending.create);
            var bSortKeys = mapping(b, Descending.create);
            return compareSortingKeys(aSortKeys, bSortKeys, comparator);
        };
    }

    function binarySearch(items, item, comparefn) {
        var left = -1,
        right = items.length,
        mid;

        while (right - left > 1) {
            mid = (left + right) >>> 1;
            var c = comparefn(items[mid], item);
            if (c < 0) {
                left = mid;
            } else {
                right = mid;
                if (!c) {
                    break;
                }
            }
        }
        return (right === items.length || comparefn(items[right], item)) ? -right - 1 : right;
    }

    function findInsertionIndex(items, newItem, comparefn) {
        var left = -1,
        right = items.length,
        mid;
        while (right - left > 1) {
            mid = (left + right) >>> 1;
            if (comparefn(items[mid], newItem) < 0) {
                left = mid;
            } else {
                right = mid;
            }
        }
        return right;
    }

    function binaryIndexOf(items, item, comparefn) {
        var index = binarySearch(items, item, comparefn);
        if (index < 0 || items.length <= index || comparefn(items[index], item) !== 0) {
            return -1;
        } else {
            var startIndex = index;
            // find the first index of an item that looks like the item
            while (index - 1 >= 0 && comparefn(items[index - 1], item) === 0) {
                index -= 1;
            }

            // find the index of the item
            while (index <= startIndex) {
                if (items[index] === item) {
                    return index;
                }
                index += 1;
            }

            while (index < items.length) {
                if (comparefn(items[index], item) !== 0) {
                    return -1;
                }
                if (items[index] === item) {
                    return index;
                }

                index += 1;
            }

            return -1;
        }
    }

    function SortedStateItem(transformation, inputItem) {
        this.transformation = transformation;
        this.inputItem = inputItem;

        this.mappedValueComputed = ko.computed(this.mappingEvaluator, this);
        this.mappedValueComputed.subscribe(this.onMappingResultChanged, this);
        this.previousMappedValue = this.mappedValueComputed.peek();
    }

    SortedStateItem.prototype.dispose = function () {
        var mappedItem = this.mappedValueComputed();
        this.mappedValueComputed.dispose();
        if (this.transformation.options.disposeItem) {
            this.transformation.options.disposeItem(mappedItem);
        }
    };

    SortedStateItem.prototype.mappingEvaluator = function () {
        return this.transformation.mapping(this.inputItem, SortByTransformation.Descending.create);
    };

    SortedStateItem.prototype.onMappingResultChanged = function (newValue) {
        if (!sortingKeysEquals(newValue, this.previousMappedValue)) {
            var transformation = this.transformation;
            var outputObservable = transformation.outputObservable;
            var outputArray = outputObservable.peek();
            var stateItems = transformation.stateItems;
            var oldIndex = binaryIndexOf(stateItems, this, mappingToComparefn(function (stateItem) {
                return stateItem.previousMappedValue;
            }, transformation.comparator));

            if (stateItems[oldIndex] === this) {
                outputObservable.valueWillMutate();
                // It seems the sort order of the underlying array is still usable
                outputArray.splice(oldIndex, 1);
                stateItems.splice(oldIndex, 1);

                var index = findInsertionIndex(outputArray, this.inputItem, transformation.comparefn);
                outputArray.splice(index, 0, this.inputItem);
                stateItems.splice(index, 0, this);

                this.previousMappedValue = newValue;
                outputObservable.valueHasMutated();
            } else {
                ko.utils.arrayForEach(stateItems, function (stateItem) {
                    stateItem.previousMappedValue = stateItem.mappingEvaluator();
                });

                // The underlying array needs to be recalculated from scratch
                stateItems.sort(mappingToComparefn(function (stateItem) {
                    return stateItem.previousMappedValue;
                }, transformation.comparator));

                outputArray = [];
                ko.utils.arrayForEach(stateItems, function (stateItem) {
                    outputArray.push(stateItem.inputItem);
                });
                outputObservable(outputArray);
            }
        }
    };

    function SortByTransformation(inputObservableArray, options) {
        var that = this;
        this.options = options;

        this.mapping = options.mapping;
        if (options.comparator) {
            this.comparator = options.comparator;
        } else {
            this.comparator = function (a, b) {
                if (a > b) {
                    return 1;
                } else if (b > a) {
                    return -1;
                } else {
                    return 0;
                }
            };
        }
        this.comparefn = mappingToComparefn(this.mapping, this.comparator);

        this.stateItems = ko.utils.arrayMap(inputObservableArray.peek(), function (inputItem) {
            return new SortedStateItem(that, inputItem);
        });
        this.stateItems.sort(function (a, b) {
            return compareSortingKeys(a.mappedValueComputed(), b.mappedValueComputed(), that.comparator);
        });

        this.outputObservable = ko.observable(ko.utils.arrayMap(this.stateItems, function (stateItem) {
            return stateItem.inputItem;
        }));

        // If the input array changes structurally (items added or removed), update the outputs
        var inputArraySubscription = inputObservableArray.subscribe(this.onStructuralChange, this, 'arrayChange');

        var outputComputed = ko.computed(this.outputObservable);
        if ('throttle' in options) {
            outputComputed = outputComputed.extend({ throttle: options.throttle });
        }

        // Return value is a readonly computed which can track its own changes to permit chaining.
        // When disposed, it cleans up everything it created.
        this.output = outputComputed.extend({ trackArrayChanges: true });
        var originalDispose = this.output.dispose;
        this.output.dispose = function () {
            inputArraySubscription.dispose();
            ko.utils.arrayForEach(that.stateItems, function (stateItem) {
                stateItem.dispose();
            });
            originalDispose.call(this, arguments);
        };

        ko.utils.extend(this.output, ko.transformations.fn);
    }

    SortByTransformation.Descending = function Descending(value) {
        this.value = value;
    };

    SortByTransformation.Descending.create = function (value) {
        return new SortByTransformation.Descending(value);
    };

    SortByTransformation.prototype.onStructuralChange = function (diff) {
        if (!diff.length) {
            return;
        }

        this.outputObservable.valueWillMutate();

        var that = this;
        var addQueue = [];
        var deleteQueue = [];
        ko.utils.arrayForEach(diff, function (diffEntry) {
            if (typeof diffEntry.moved !== 'number') {
                switch (diffEntry.status) {
                case 'added':
                    addQueue.push(diffEntry);
                    break;
                case 'deleted':
                    deleteQueue.push(diffEntry);
                    break;
                }
            }
        });

        var outputArray = this.outputObservable.peek();
        ko.utils.arrayForEach(deleteQueue, function (diffEntry) {
            var index = binaryIndexOf(outputArray, diffEntry.value, that.comparefn);
            if (index !== -1) {
                outputArray.splice(index, 1);
                that.stateItems[index].dispose();
                that.stateItems.splice(index, 1);
            }
        });

        if (deleteQueue.length === 0 && this.stateItems.length === 0) {
            // Adding to an empty array
            this.stateItems = ko.utils.arrayMap(addQueue, function (diffEntry) {
                return new SortedStateItem(that, diffEntry.value);
            });

            this.stateItems.sort(function (a, b) {
                return compareSortingKeys(a.mappedValueComputed(), b.mappedValueComputed(), that.comparator);
            });

            ko.utils.arrayForEach(this.stateItems, function (stateItem) {
                outputArray.push(stateItem.inputItem);
            });
        } else {
            ko.utils.arrayForEach(addQueue, function (diffEntry) {
                var index = findInsertionIndex(outputArray, diffEntry.value, that.comparefn);
                var stateItem = new SortedStateItem(that, diffEntry.value);
                outputArray.splice(index, 0, stateItem.inputItem);
                that.stateItems.splice(index, 0, stateItem);
            });
        }

        this.outputObservable.valueHasMutated();
    };

    ko.observableArray.fn.sortBy = ko.transformations.fn.sortBy = function sortBy(options) {
        // Shorthand syntax - just pass a function instead of an options object
        if (typeof options === 'function') {
            options = { mapping: options };
        }

        var transformation = new SortByTransformation(this, options);

        return transformation.output;
    };

    return ko.transformations.fn.sortBy;
}));
