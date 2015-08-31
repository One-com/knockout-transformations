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

    function compareStateItems(aStateItem, bStateItem, reevaluateA) {
        var Descending = SortByTransformation.Descending;
        var aSortKeys = reevaluateA ? aStateItem.mappingEvaluator(true) : aStateItem.previousMappedValue;
        var bSortKeys = bStateItem.previousMappedValue;
        var comparator = aStateItem.transformation.comparator;

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

    function binarySearch(items, item, reevaluate) {
        var left = -1,
        right = items.length,
        mid,
        c;

        while (right - left > 1) {
            mid = (left + right) >>> 1;
            c = compareStateItems(items[mid], item, reevaluate);
            if (c < 0) {
                left = mid;
            } else if (c > 0) {
                right = mid;
            } else {
                return mid;
            }
        }

        return -1;
    }

    function findInsertionIndex(items, newItem) {
        var left = -1,
        right = items.length,
        mid;
        while (right - left > 1) {
            mid = (left + right) >>> 1;
            if (compareStateItems(items[mid], newItem) < 0) {
                left = mid;
            } else {
                right = mid;
            }
        }
        return right;
    }

    function binaryIndexOf(items, item, reevaluate) {
        var index = binarySearch(items, item, reevaluate);
        if (index < 0 || index >= items.length) {
            return -1;
        } else if (items[index].inputItem === item.inputItem) {
            return index;
        } else {
            var startIndex = index;
            // Work backwards to find the first index of an item that looks like the desired item
            while (index - 1 >= 0 && compareStateItems(items[index - 1], item, reevaluate) === 0) {
                index -= 1;

                // If we have a match return the index
                if (items[index].inputItem === item.inputItem) {
                    return index;
                }
            }

            // Jump back to the starting point plus one
            index = startIndex + 1;

            // Work forwards until a match is found or the item no longer looks like the desired item
            while (index < items.length) {
                if (compareStateItems(items[index], item, reevaluate) !== 0) {
                    return -1;
                }
                if (items[index].inputItem === item.inputItem) {
                    return index;
                }

                index += 1;
            }

            return -1;
        }
    }

    function SortedStateItem(transformation, inputItem, mockStateItem) {
        this.transformation = transformation;
        this.inputItem = inputItem;
        this.mockStateItem = mockStateItem;

        this.mappedValueComputed = ko.computed(this.mappingEvaluator, this);
        this.mappedValueComputed.subscribe(this.onMappingResultChanged, this);
        this.previousMappedValue = this.mappedValueComputed.peek();

        if (mockStateItem) {
            this.dispose();
        }
    }

    SortedStateItem.prototype.dispose = function () {
        var mappedItem = this.mappedValueComputed();
        this.mappedValueComputed.dispose();
        if (this.transformation.options.disposeItem) {
            this.transformation.options.disposeItem(mappedItem);
        }
    };

    SortedStateItem.prototype.mappingEvaluator = function (mockStateItem) {
        mockStateItem = (this.mockStateItem || !!mockStateItem);
        var mappingResult = this.transformation.mapping(this.inputItem, SortByTransformation.Descending.create, mockStateItem);
        return Array.isArray(mappingResult) ? mappingResult : [mappingResult];
    };

    SortedStateItem.prototype.onMappingResultChanged = function (newValue) {
        if (sortingKeysEquals(newValue, this.previousMappedValue)) {
            return;
        }

        var transformation = this.transformation;
        var outputObservable = transformation.outputObservable;
        var outputArray = outputObservable.peek();
        var stateItems = transformation.stateItems;
        var oldIndex = binaryIndexOf(stateItems, this);

        if (stateItems[oldIndex] === this) {
            outputObservable.valueWillMutate();
            // It seems the sort order of the underlying array is still usable
            outputArray.splice(oldIndex, 1);
            stateItems.splice(oldIndex, 1);

            this.previousMappedValue = newValue;

            var index = findInsertionIndex(stateItems, this);
            outputArray.splice(index, 0, this.inputItem);
            stateItems.splice(index, 0, this);

            outputObservable.valueHasMutated();
        } else {
            ko.utils.arrayForEach(stateItems, function (stateItem) {
                stateItem.previousMappedValue = stateItem.mappingEvaluator();
            });

            // The underlying array needs to be recalculated from scratch
            stateItems.sort(compareStateItems);

            outputArray = [];
            ko.utils.arrayForEach(stateItems, function (stateItem) {
                outputArray.push(stateItem.inputItem);
            });
            outputObservable(outputArray);
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

        this.stateItems = ko.utils.arrayMap(inputObservableArray.peek(), function (inputItem) {
            return new SortedStateItem(that, inputItem);
        });

        this.stateItems.sort(compareStateItems);

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
        var outputArray = this.outputObservable.peek();
        var stateItems = this.stateItems;
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

        ko.utils.arrayForEach(deleteQueue, function (diffEntry) {
            var stateItemToDelete = new SortedStateItem(that, diffEntry.value, true);
            var indexToDelete = binaryIndexOf(stateItems, stateItemToDelete);

            if (indexToDelete === -1) {
                // If the source array is or has a filter transformation, an item may be being removed because an observable
                // used in the filter transformation updated.
                // If in this sortBy transformation we're sorting using that same observable the mapping will not have yet
                // re-evaluated and thus will not match the stored previousMappedValue.

                // Hence compare it against current mapping evaluations.
                indexToDelete = binaryIndexOf(stateItems, stateItemToDelete, true);
            }
            if (indexToDelete !== -1) {
                stateItems[indexToDelete].dispose();
                outputArray.splice(indexToDelete, 1);
                stateItems.splice(indexToDelete, 1);
            }
        });

        if (deleteQueue.length === 0 && stateItems.length === 0) {
            // Adding to an empty array
            ko.utils.arrayForEach(addQueue, function (diffEntry) {
                stateItems.push(new SortedStateItem(that, diffEntry.value));
            });

            stateItems.sort(compareStateItems);

            ko.utils.arrayForEach(stateItems, function (stateItem) {
                outputArray.push(stateItem.inputItem);
            });
        } else {
            ko.utils.arrayForEach(addQueue, function (diffEntry) {
                var stateItemToInsert = new SortedStateItem(that, diffEntry.value);
                var indexToInsertAt = findInsertionIndex(stateItems, stateItemToInsert);
                outputArray.splice(indexToInsertAt, 0, stateItemToInsert.inputItem);
                stateItems.splice(indexToInsertAt, 0, stateItemToInsert);
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
