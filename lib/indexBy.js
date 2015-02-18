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

        var outputComputed = ko.computed(this.outputObservable);
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

        ko.utils.extend(this.output, ko.transformations.fn);
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


    ko.observableArray.fn.indexBy = ko.transformations.fn.indexBy = function indexBy(options) {
        // Shorthand syntax - just pass a function instead of an options object
        if (typeof options === 'function') {
            options = { mapping: options, unique: false };
        }

        var transformation = options.unique ?
            new UniqueIndexByTransformation(this, options) :
            new IndexByTransformation(this, options);

        return transformation.output;
    };

    ko.observableArray.fn.uniqueIndexBy = ko.transformations.fn.uniqueIndexBy = function uniqueIndexBy(options) {
        // Shorthand syntax - just pass a function instead of an options object
        if (typeof options === 'function') {
            options = { mapping: options };
        }
        options.unique = true;

        var transformation = new UniqueIndexByTransformation(this, options);

        return transformation.output;
    };

    return ko.transformations.fn.indexBy;
}));
