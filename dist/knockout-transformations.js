!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self),o.knockoutTransformations=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var ko = require(3);
var namespace = require(5);
require(4);

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

},{}],2:[function(require,module,exports){
var ko = require(3);
var namespace = require(5);

function IndexByTransformation(inputObservableArray, options) {
    var that = this;
    this.options = options;
    this.outputObservable = ko.observable({});
    this.stateItems = {};

    this.mapping = function (item) {
        return [].concat(options.mapping(item));
    };

    var inputArray = inputObservableArray.peek();
    for (var i = 0; i < inputArray.length; i += 1) {
        this.addToIndex(inputArray[i], i);
    }

    // If the input array changes structurally (items added or removed), update the outputs
    var inputArraySubscription = inputObservableArray.subscribe(this.onStructuralChange, this, 'arrayChange');

    var outputComputed = ko.pureComputed(this.outputObservable);
    if ('throttle' in options) {
        outputComputed = outputComputed.extend({ throttle: options.throttle });
    }

    // Return value is a readonly, when disposed, it cleans up everything it created.
    this.output = outputComputed;
    var originalDispose = this.output.dispose;
    this.output.dispose = function () {
        inputArraySubscription.dispose();
        for (var prop in that.stateItems) {
            if (that.stateItems.hasOwnProperty(prop)) {
                that.stateItems[prop].dispose();
            }
        }
        originalDispose.call(this, arguments);
    };

    ko.utils.extend(this.output, namespace.fn);
}

IndexByTransformation.prototype.arraysEqual = function (a, b) {
    if (a === b) {
        return true;
    }

    if (typeof a === 'undefined' || typeof b === 'undefined') {
        return false;
    }

    if (a.length !== b.length) {
        return false;
    }

    for (var i = 0; i < a.length; i += 1) {
        if ((ko.observable.fn.equalityComparer &&
             ko.isObservable(a[i]) &&
             !ko.observable.fn.equalityComparer(a[i], b[i])) ||
            a[i] !== b[i]) {
            return false;
        }
    }
    return true;
};


IndexByTransformation.prototype.appendToEntry = function (obj, key, item) {
    var entry = obj[key];
    if (!entry) {
        entry = obj[key] = [];
    }
    entry.push(item);
};

IndexByTransformation.prototype.removeFromEntry = function (obj, key, item) {
    var entry = obj[key];
    if (entry) {
        var index = entry.indexOf(item);
        if (index !== -1) {
            if (entry.length === 1) {
                delete obj[key];
            } else {
                entry.splice(index, 1);
            }
        }
    }
};

IndexByTransformation.prototype.insertByKeyAndItem = function (indexMapping, key, item) {
    this.appendToEntry(indexMapping, key, item);
};

IndexByTransformation.prototype.removeByKeyAndItem = function (indexMapping, key, item) {
    this.removeFromEntry(indexMapping, key, item);
};

IndexByTransformation.prototype.addStateItemToIndex = function (stateItem) {
    var key = this.mapping(stateItem.inputItem)[0];
    this.appendToEntry(this.stateItems, key, stateItem);
};

IndexByTransformation.prototype.findStateItem = function (inputItem) {
    var key = this.mapping(inputItem)[0];
    var entry = this.stateItems[key];
    if (!entry) {
        return null;
    }

    var result = ko.utils.arrayFilter(entry, function (stateItem) {
        return stateItem.inputItem === inputItem;
    });
    return result[0] || null;
};

IndexByTransformation.prototype.removeStateItem = function (stateItem) {
    var key = stateItem.mappedValueComputed()[0];
    this.removeFromEntry(this.stateItems, key, stateItem);
    stateItem.dispose();
};

IndexByTransformation.prototype.addToIndex = function (inputItem) {
    var that = this;
    var keys = this.mapping(inputItem);
    var output = this.outputObservable.peek();
    ko.utils.arrayForEach(keys, function (key) {
        that.insertByKeyAndItem(output, key, inputItem);
    });
    var stateItem = new IndexedStateItem(this, inputItem);
    this.addStateItemToIndex(stateItem);
};

IndexByTransformation.prototype.removeItem = function (inputItem) {
    var that = this;
    var stateItem = this.findStateItem(inputItem);
    if (stateItem) {
        var keys = stateItem.mappedValueComputed();
        var output = this.outputObservable.peek();
        ko.utils.arrayForEach(keys, function (key) {
            that.removeByKeyAndItem(output, key, inputItem);
        });
        this.removeStateItem(stateItem);
    }
};

IndexByTransformation.prototype.onStructuralChange = function (diff) {
    var that = this;
    if (!diff.length) {
        return;
    }

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

    ko.utils.arrayForEach(deleteQueue, function (diffEntry) {
        that.removeItem(diffEntry.value, diffEntry.index);
    });

    ko.utils.arrayForEach(addQueue, function (diffEntry) {
        that.addToIndex(diffEntry.value, diffEntry.index);
    });

    this.outputObservable.valueHasMutated();
};

function IndexedStateItem(transformation, inputItem) {
    this.transformation = transformation;
    this.inputItem = inputItem;
    this.mappedValueComputed = ko.computed(this.mappingEvaluator, this);
    this.mappedValueComputed.subscribe(this.onMappingResultChanged, this);
    this.previousMappedValue = this.mappedValueComputed.peek();
}

IndexedStateItem.prototype.dispose = function () {
    var mappedItem = this.mappedValueComputed();
    this.mappedValueComputed.dispose();

    if (this.transformation.options.disposeItem) {
        this.transformation.options.disposeItem(mappedItem);
    }
};

IndexedStateItem.prototype.mappingEvaluator = function () {
    return this.transformation.mapping(this.inputItem);
};

IndexedStateItem.prototype.onMappingResultChanged = function (newValue) {
    var transformation = this.transformation;
    if (!transformation.arraysEqual(this.newValue, this.previousMappedValue)) {
        var outputObservable = transformation.outputObservable;
        var output = outputObservable.peek();
        outputObservable.valueWillMutate();
        transformation.removeByKeyAndItem(output, this.previousMappedValue, this.inputItem);
        transformation.removeByKeyAndItem(transformation.stateItems, this.previousMappedValue, this);
        transformation.insertByKeyAndItem(output, newValue, this.inputItem);
        transformation.addStateItemToIndex(this);
        this.previousMappedValue = newValue;
        outputObservable.valueHasMutated();
    }
};

function UniqueIndexByTransformation(inputObservableArray, options) {
    IndexByTransformation.call(this, inputObservableArray, options);
}

ko.utils.extend(UniqueIndexByTransformation.prototype, IndexByTransformation.prototype);

UniqueIndexByTransformation.prototype.insertByKeyAndItem = function (indexMapping, key, item) {
    if (key in indexMapping) {
        throw new Error('Unique indexes requires items must map to different keys; duplicate key: ' + key);
    }

    indexMapping[key] = item;
};

UniqueIndexByTransformation.prototype.removeByKeyAndItem = function (indexMapping, key) {
    delete indexMapping[key];
};

UniqueIndexByTransformation.prototype.addStateItemToIndex = function (stateItem) {
    var key = stateItem.mappedValueComputed()[0];
    this.stateItems[key] = stateItem;
};

UniqueIndexByTransformation.prototype.findStateItem = function (inputItem) {
    var key = this.mapping(inputItem)[0];
    return this.stateItems[key] || null;
};

UniqueIndexByTransformation.prototype.removeStateItem = function (stateItem) {
    var key = stateItem.mappedValueComputed()[0];
    if (this.stateItems[key] === stateItem) {
        delete this.stateItems[key];
    }
    stateItem.dispose();
};

UniqueIndexByTransformation.prototype.addToIndex = function (inputItem) {
    var that = this;
    var keys = this.mapping(inputItem);
    var output = this.outputObservable.peek();
    ko.utils.arrayForEach(keys, function (key) {
        that.insertByKeyAndItem(output, key, inputItem);
    });
    var stateItem = new UniqueIndexedStateItem(this, inputItem);
    this.addStateItemToIndex(stateItem);
};

UniqueIndexByTransformation.prototype.removeItem = function (inputItem) {
    var that = this;
    var stateItem = this.findStateItem(inputItem);
    if (stateItem) {
        var keys = stateItem.mappedValueComputed();
        var output = this.outputObservable.peek();
        ko.utils.arrayForEach(keys, function (key) {
            that.removeByKeyAndItem(output, key, inputItem);
        });
        this.removeStateItem(stateItem);
    }
};

function UniqueIndexedStateItem(transformation, inputItem) {
    IndexedStateItem.call(this, transformation, inputItem);
}

ko.utils.extend(UniqueIndexedStateItem.prototype, IndexedStateItem.prototype);


ko.observableArray.fn.indexBy = namespace.fn.indexBy = function indexBy(options) {
    // Shorthand syntax - just pass a function instead of an options object
    if (typeof options === 'function') {
        options = { mapping: options, unique: false };
    }

    var transformation = options.unique ?
        new UniqueIndexByTransformation(this, options) :
        new IndexByTransformation(this, options);

    return transformation.output;
};

ko.observableArray.fn.uniqueIndexBy = namespace.fn.uniqueIndexBy = function uniqueIndexBy(options) {
    // Shorthand syntax - just pass a function instead of an options object
    if (typeof options === 'function') {
        options = { mapping: options };
    }
    options.unique = true;

    var transformation = new UniqueIndexByTransformation(this, options);

    return transformation.output;
};

},{}],3:[function(require,module,exports){
var ko = typeof window === 'undefined' || typeof window.ko === 'undefined' ?
    require("knockout") : window.ko;
module.exports = ko;

},{}],4:[function(require,module,exports){
var ko = require(3);
var namespace = require(5);

function StateItem(inputItem, initialStateArrayIndex, initialOutputArrayIndex, mappingOptions, arrayOfState, outputObservableArray) {
    // Capture state for later use
    this.inputItem = inputItem;
    this.stateArrayIndex = initialStateArrayIndex;
    this.mappingOptions = mappingOptions;
    this.arrayOfState = arrayOfState;
    this.outputObservableArray = outputObservableArray;
    this.outputArray = this.outputObservableArray.peek();
    this.isIncluded = null; // Means 'not yet determined'
    this.suppressNotification = false; // TODO: Instead of this technique, consider raising a sparse diff with a "mutated" entry when a single item changes, and not having any other change logic inside StateItem

    // Set up observables
    this.outputArrayIndex = ko.observable(initialOutputArrayIndex); // When excluded, it's the position the item would go if it became included
    this.disposeFuncFromMostRecentMapping = null;
    this.mappedValueComputed = ko.computed(this.mappingEvaluator, this);
    this.mappedValueComputed.subscribe(this.onMappingResultChanged, this);
    this.previousMappedValue = this.mappedValueComputed.peek();
}

StateItem.prototype.dispose = function () {
    this.mappedValueComputed.dispose();
    this.disposeResultFromMostRecentEvaluation();
};

StateItem.prototype.disposeResultFromMostRecentEvaluation = function () {
    if (this.disposeFuncFromMostRecentMapping) {
        this.disposeFuncFromMostRecentMapping();
        this.disposeFuncFromMostRecentMapping = null;
    }

    if (this.mappingOptions.disposeItem) {
        var mappedItem = this.mappedValueComputed();
        this.mappingOptions.disposeItem(mappedItem);
    }
};

StateItem.prototype.mappingEvaluator = function () {
    if (this.isIncluded !== null) { // i.e., not first run
        // This is a replace-in-place, so call any dispose callbacks
        // we have for the earlier value
        this.disposeResultFromMostRecentEvaluation();
    }

    var mappedValue;
    if (this.mappingOptions.mapping) {
        mappedValue = this.mappingOptions.mapping(this.inputItem, this.outputArrayIndex);
    } else if (this.mappingOptions.mappingWithDisposeCallback) {
        var mappedValueWithDisposeCallback = this.mappingOptions.mappingWithDisposeCallback(this.inputItem, this.outputArrayIndex);
        if (!('mappedValue' in mappedValueWithDisposeCallback)) {
            throw new Error('Return value from mappingWithDisposeCallback should have a \'mappedItem\' property.');
        }
        mappedValue = mappedValueWithDisposeCallback.mappedValue;
        this.disposeFuncFromMostRecentMapping = mappedValueWithDisposeCallback.dispose;
    } else {
        throw new Error('No mapping callback given.');
    }

    if (this.isIncluded === null) { // first run
        this.isIncluded = mappedValue !== this.mappingOptions.exclusionMarker;
    }

    return mappedValue;
};

StateItem.prototype.updateInclusion = function () {
    var outputArrayIndex = this.outputArrayIndex.peek();
    var outputArray = this.outputArray;
    for (var iterationIndex = this.stateArrayIndex; iterationIndex < this.arrayOfState.length; iterationIndex += 1) {
        var stateItem = this.arrayOfState[iterationIndex];

        stateItem.setOutputArrayIndexSilently(outputArrayIndex);
        var newValue = stateItem.mappingEvaluator();
        var newInclusionState = newValue !== this.mappingOptions.exclusionMarker;

        // Inclusion state changes can *only* happen as a result of changing an individual item.
        // Structural changes to the array can't cause this (because they don't cause any remapping;
        // they only map newly added items which have no earlier inclusion state to change).
        if (newInclusionState) {
            outputArray[outputArrayIndex] = newValue;
            outputArrayIndex += 1;
        }

        stateItem.previousMappedValue = newValue;
        stateItem.isIncluded = newInclusionState;
    }
    if (outputArrayIndex < outputArray.length) {
        outputArray.length = outputArrayIndex;
    }
};

StateItem.prototype.onMappingResultChanged = function (newValue) {
    if (newValue !== this.previousMappedValue) {
        if (!this.suppressNotification) {
            this.outputObservableArray.valueWillMutate();
        }

        var newInclusionState = newValue !== this.mappingOptions.exclusionMarker;
        if (this.isIncluded !== newInclusionState) {
            this.updateInclusion();
        } else {
            if (newInclusionState) {
                this.outputArray[this.outputArrayIndex.peek()] = newValue;
            }
            this.previousMappedValue = newValue;
        }

        if (!this.suppressNotification) {
            this.outputObservableArray.valueHasMutated();
        }
    }
};

StateItem.prototype.setOutputArrayIndexSilently = function (newIndex) {
    // We only want to raise one output array notification per input array change,
    // so during processing, we suppress notifications
    this.suppressNotification = true;
    this.outputArrayIndex(newIndex);
    this.suppressNotification = false;
};

function getDiffEntryPostOperationIndex(diffEntry, editOffset) {
    // The diff algorithm's "index" value refers to the output array for additions,
    // but the "input" array for deletions. Get the output array position.
    if (!diffEntry) { return null; }
    switch (diffEntry.status) {
    case 'added':
        return diffEntry.index;
    case 'deleted':
        return diffEntry.index + editOffset;
    default:
        throw new Error('Unknown diff status: ' + diffEntry.status);
    }
}

function insertOutputItem(diffEntry, movedStateItems, stateArrayIndex, outputArrayIndex, mappingOptions, arrayOfState, outputObservableArray, outputArray) {
    // Retain the existing mapped value if this is a move, otherwise perform mapping
    var isMoved = typeof diffEntry.moved === 'number',
    stateItem = isMoved ?
        movedStateItems[diffEntry.moved] :
        new StateItem(diffEntry.value, stateArrayIndex, outputArrayIndex, mappingOptions, arrayOfState, outputObservableArray);
    arrayOfState.splice(stateArrayIndex, 0, stateItem);

    if (stateItem.isIncluded) {
        outputArray.splice(outputArrayIndex, 0, stateItem.mappedValueComputed.peek());
    }

    // Update indexes
    if (isMoved) {
        // We don't change the index until *after* updating this item's position in outputObservableArray,
        // because changing the index may trigger re-mapping, which in turn would cause the new
        // value to be written to the 'index' position in the output array
        stateItem.stateArrayIndex = stateArrayIndex;
        stateItem.setOutputArrayIndexSilently(outputArrayIndex);
    }

    return stateItem;
}

function deleteOutputItem(diffEntry, arrayOfState, stateArrayIndex, outputArrayIndex, outputArray) {
    var stateItem = arrayOfState.splice(stateArrayIndex, 1)[0];
    if (stateItem.isIncluded) {
        outputArray.splice(outputArrayIndex, 1);
    }
    if (typeof diffEntry.moved !== 'number') {
        // Be careful to dispose only if this item really was deleted and not moved
        stateItem.dispose();
    }
}

function updateRetainedOutputItem(stateItem, stateArrayIndex, outputArrayIndex) {
    // Just have to update its indexes
    stateItem.stateArrayIndex = stateArrayIndex;
    stateItem.setOutputArrayIndexSilently(outputArrayIndex);

    // Return the new value for outputArrayIndex
    return outputArrayIndex + (stateItem.isIncluded ? 1 : 0);
}

function makeLookupOfMovedStateItems(diff, arrayOfState) {
    // Before we mutate arrayOfComputedMappedValues at all, grab a reference to each moved item
    var movedStateItems = {};
    for (var diffIndex = 0; diffIndex < diff.length; diffIndex += 1) {
        var diffEntry = diff[diffIndex];
        if (diffEntry.status === 'added' && (typeof diffEntry.moved === 'number')) {
            movedStateItems[diffEntry.moved] = arrayOfState[diffEntry.moved];
        }
    }
    return movedStateItems;
}

function getFirstModifiedOutputIndex(firstDiffEntry, arrayOfState, outputArray) {
    // Work out where the first edit will affect the output array
    // Then we can update outputArrayIndex incrementally while walking the diff list
    if (!outputArray.length || !arrayOfState[firstDiffEntry.index]) {
        // The first edit is beyond the end of the output or state array, so we must
        // just be appending items.
        return outputArray.length;
    } else {
        // The first edit corresponds to an existing state array item, so grab
        // the first output array index from it.
        return arrayOfState[firstDiffEntry.index].outputArrayIndex.peek();
    }
}

function respondToArrayStructuralChanges(inputObservableArray, arrayOfState, outputArray, outputObservableArray, mappingOptions) {
    return inputObservableArray.subscribe(function (diff) {
        if (!diff.length) {
            return;
        }

        outputObservableArray.valueWillMutate();

        var movedStateItems = makeLookupOfMovedStateItems(diff, arrayOfState),
        diffIndex = 0,
        diffEntry = diff[0],
        editOffset = 0, // A running total of (num(items added) - num(items deleted)) not accounting for filtering
        outputArrayIndex = diffEntry && getFirstModifiedOutputIndex(diffEntry, arrayOfState, outputArray);

        // Now iterate over the state array, at each stage checking whether the current item
        // is the next one to have been edited. We can skip all the state array items whose
        // indexes are less than the first edit index (i.e., diff[0].index).
        for (var stateArrayIndex = diffEntry.index; diffEntry || (stateArrayIndex < arrayOfState.length); stateArrayIndex += 1) {
            // Does the current diffEntry correspond to this position in the state array?
            if (getDiffEntryPostOperationIndex(diffEntry, editOffset) === stateArrayIndex) {
                // Yes - insert or delete the corresponding state and output items
                switch (diffEntry.status) {
                case 'added':
                    // Add to output, and update indexes
                    var stateItem = insertOutputItem(diffEntry, movedStateItems, stateArrayIndex, outputArrayIndex, mappingOptions, arrayOfState, outputObservableArray, outputArray);
                    if (stateItem.isIncluded) {
                        outputArrayIndex += 1;
                    }
                    editOffset += 1;
                    break;
                case 'deleted':
                    // Just erase from the output, and update indexes
                    deleteOutputItem(diffEntry, arrayOfState, stateArrayIndex, outputArrayIndex, outputArray);
                    editOffset -= 1;
                    stateArrayIndex -= 1; // To compensate for the "for" loop incrementing it
                    break;
                default:
                    throw new Error('Unknown diff status: ' + diffEntry.status);
                }

                // We're done with this diff entry. Move on to the next one.
                diffIndex += 1;
                diffEntry = diff[diffIndex];
            } else if (stateArrayIndex < arrayOfState.length) {
                // No - the current item was retained. Just update its index.
                outputArrayIndex = updateRetainedOutputItem(arrayOfState[stateArrayIndex], stateArrayIndex, outputArrayIndex);
            }
        }

        outputObservableArray.valueHasMutated();
    }, null, 'arrayChange');
}

ko.observableArray.fn.map = namespace.fn.map = function map(mappingOptions) {
    var that = this,
    arrayOfState = [],
    outputArray = [],
    outputObservableArray = ko.observableArray(outputArray),
    originalInputArrayContents = that.peek();

    // Shorthand syntax - just pass a function instead of an options object
    if (typeof mappingOptions === 'function') {
        mappingOptions = { mapping: mappingOptions };
    }

    if (!mappingOptions.exclusionMarker) {
        mappingOptions.exclusionMarker = {};
    }

    // Validate the options
    if (mappingOptions.mappingWithDisposeCallback) {
        if (mappingOptions.mapping || mappingOptions.disposeItem) {
            throw new Error('\'mappingWithDisposeCallback\' cannot be used in conjunction with \'mapping\' or \'disposeItem\'.');
        }
    } else if (!mappingOptions.mapping) {
        throw new Error('Specify either \'mapping\' or \'mappingWithDisposeCallback\'.');
    }

    // Initial state: map each of the inputs
    for (var i = 0; i < originalInputArrayContents.length; i += 1) {
        var inputItem = originalInputArrayContents[i],
        stateItem = new StateItem(inputItem, i, outputArray.length, mappingOptions, arrayOfState, outputObservableArray),
        mappedValue = stateItem.mappedValueComputed.peek();
        arrayOfState.push(stateItem);

        if (stateItem.isIncluded) {
            outputArray.push(mappedValue);
        }
    }

    // If the input array changes structurally (items added or removed), update the outputs
    var inputArraySubscription = respondToArrayStructuralChanges(that, arrayOfState, outputArray, outputObservableArray, mappingOptions);

    var outputComputed = outputObservableArray;
    if ('throttle' in mappingOptions) {
        outputComputed = ko.pureComputed(outputObservableArray).extend({ throttle: mappingOptions.throttle });
    }
    // Return value is a readonly computed which can track its own changes to permit chaining.
    // When disposed, it cleans up everything it created.
    var returnValue = ko.pureComputed(outputComputed).extend({ trackArrayChanges: true }),
    originalDispose = returnValue.dispose;
    returnValue.dispose = function () {
        inputArraySubscription.dispose();
        ko.utils.arrayForEach(arrayOfState, function (stateItem) {
            stateItem.dispose();
        });
        originalDispose.call(this, arguments);
    };

    // Make transformations chainable
    ko.utils.extend(returnValue, namespace.fn);

    return returnValue;
};

},{}],5:[function(require,module,exports){
var ko = require(3);

ko.transformations = ko.transformations || {
    fn: {}
};

module.exports = ko.transformations;

},{}],6:[function(require,module,exports){
var ko = require(3);
var namespace = require(5);

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

function compareSortingKeys(aSortKeys, bSortKeys) {
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
            if (aSortKey.value > bSortKey.value) {
                return -1;
            } else if (aSortKey.value < bSortKey.value) {
                return 1;
            }
        } else {
            if (aSortKey < bSortKey) {
                return -1;
            } else if (aSortKey > bSortKey) {
                return 1;
            }
        }
    }
    return 0;
}

// Sorting
function mappingToComparefn(mapping) {
    var Descending = SortByTransformation.Descending;
    return function (a, b) {
        var aSortKeys = mapping(a, Descending.create);
        var bSortKeys = mapping(b, Descending.create);
        return compareSortingKeys(aSortKeys, bSortKeys);
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
        }));

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
            }));

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
    this.comparefn = mappingToComparefn(this.mapping);

    this.stateItems = ko.utils.arrayMap(inputObservableArray.peek(), function (inputItem) {
        return new SortedStateItem(that, inputItem);
    });
    this.stateItems.sort(function (a, b) {
        return compareSortingKeys(a.mappedValueComputed(), b.mappedValueComputed());
    });

    this.outputObservable = ko.observable(ko.utils.arrayMap(this.stateItems, function (stateItem) {
        return stateItem.inputItem;
    }));

    // If the input array changes structurally (items added or removed), update the outputs
    var inputArraySubscription = inputObservableArray.subscribe(this.onStructuralChange, this, 'arrayChange');

    var outputComputed = ko.pureComputed(this.outputObservable);
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

    ko.utils.extend(this.output, namespace.fn);
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
            return compareSortingKeys(a.mappedValueComputed(), b.mappedValueComputed());
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

ko.observableArray.fn.sortBy = namespace.fn.sortBy = function sortBy(options) {
    // Shorthand syntax - just pass a function instead of an options object
    if (typeof options === 'function') {
        options = { mapping: options };
    }

    var transformation = new SortByTransformation(this, options);

    return transformation.output;
};

},{}],7:[function(require,module,exports){
require(4);
require(1);
require(6);
require(2);

},{}]},{},[7])(7)
});