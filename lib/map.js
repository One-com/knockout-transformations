var ko = require('./knockout');
var namespace = require('./namespace.js');

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
