var ko = require('knockout');
require('../lib/knockout-transformations.js');
var expect = require('unexpected').clone()
    .installPlugin(require('unexpected-sinon'));
var sinon = require('sinon');

describe("Map", function () {
    var clock;

    beforeEach(function () {
        clock = sinon.useFakeTimers();
    });

    afterEach(function () {
        clock.restore();
    });

    var sampleData = ['Alpha', 'Beta', 'Gamma'];

    it("returns a readonly computed observable array", function() {
        var sourceArray = ko.observableArray(sampleData.slice(0)),
        mappedArray = sourceArray.map(function(item) { return item.length; });

        expect(ko.isObservable(mappedArray), 'to be', true);
        expect(ko.isComputed(mappedArray), 'to be', true);
        expect(function() { mappedArray([1, 2, 3]); }, 'to throw',
               "Cannot write a value to a ko.computed unless you specify a 'write' option. If you wish to read the current value, don't pass any parameters.");
    });

    it("maps each entry in the array, returning a new observable array", function () {
        var sourceArray = ko.observableArray(sampleData.slice(0)),
        mappedArray = sourceArray.map(function(item) { return item.length; });
        expect(mappedArray(), 'to equal', [5, 4, 5]);
    });

    it("supports an alternative 'options' object syntax", function () {
        var sourceArray = ko.observableArray(sampleData.slice(0)),
        mappedArray = sourceArray.map({
            mapping: function(item) { return item.length; }
        });
        expect(mappedArray(), 'to equal', [5, 4, 5]);
    });

    it("issues notifications when the underlying data changes, updating the mapped result", function () {
        var sourceArray = ko.observableArray(sampleData.slice(0)),
        mappedArray = sourceArray.map(function(item) { return item.length; }),
        log = [];
        mappedArray.subscribe(function(values) { log.push(values); });

        // Initial state is set without any notification
        expect(mappedArray(), 'to equal', [5, 4, 5]);
        expect(log.length, 'to be', 0);

        // Try adding an item
        sourceArray.push('Another');
        expect(log.length, 'to be', 1);
        expect(log[0], 'to equal', [5, 4, 5, 7]);

        // Try removing an item
        sourceArray.splice(1, 1);
        expect(log.length, 'to be', 2);
        expect(log[1], 'to equal', [5, 5, 7]);

        // Try mutating in place
        sourceArray()[1] = 'Modified';
        sourceArray.valueHasMutated();
        expect(log.length, 'to be', 3);
        expect(log[2], 'to equal', [5, 8, 7]);
    });

    it("does not issue notifications for in-place edits if the mapping function returns the same object instance", function() {
        // With mapping, you should typically return new object instances each time from your mapping function.
        // If you preserve object instances we assume it's not a change you want to issue notification about.
        // When the mapping result is a primitive, this isn't controversial - there really isn't a change to notify.
        // When the mapping result is a nonprimitive it's less clear what semantics you intend, and arguably you
        // might have mutated that object's internal state and expect to notify about it. But that's such a strange
        // thing to be doing, with no clear use case, I think it's OK to suppress it. This could be changed
        // or made into an option in the future.

        var sourceArray = ko.observableArray([{ value: ko.observable('Alpha') }, { value: ko.observable('Beta') }]),
        mappedItem = { theItem: true },
        mappedArray = sourceArray.map(function(item) { return mappedItem; }),
        log = [];
        mappedArray.subscribe(function(values) { log.push(ko.toJSON(values)); });

        // Initial state
        expect(mappedArray(), 'to equal', [mappedItem, mappedItem]);
        expect(ko.toJSON(mappedArray), 'to be', '[{"theItem":true},{"theItem":true}]');
        expect(log.length, 'to be', 0);

        // Since the mapping returns the same object instance, we don't treat it as a change to notify about
        sourceArray()[0].value('Alphalonger');
        expect(log.length, 'to be', 0);
        expect(ko.toJSON(mappedArray), 'to be', '[{"theItem":true},{"theItem":true}]');
    });

    it("is possible to chain mappings", function() {
        var sourceArray = ko.observableArray(sampleData.slice(0)),
        mappedArray1 = sourceArray.map(function(item) { return item + item.toUpperCase(); }),
        mappedArray2 = mappedArray1.map(function(item) { return item.length; }),
        log1 = [],
        log2 = [];
        mappedArray1.subscribe(function(values) { log1.push(values); });
        mappedArray2.subscribe(function(values) { log2.push(values); });

        // Initial state is set without any notification
        expect(mappedArray1(), 'to equal', ['AlphaALPHA', 'BetaBETA', 'GammaGAMMA']);
        expect(mappedArray2(), 'to equal', [10, 8, 10]);
        expect(log1.length, 'to be', 0);
        expect(log2.length, 'to be', 0);

        // Try adding an item
        sourceArray.push('Another');
        expect(log1.length, 'to be', 1);
        expect(log2.length, 'to be', 1);
        expect(log1[0], 'to equal', ['AlphaALPHA', 'BetaBETA', 'GammaGAMMA', 'AnotherANOTHER']);
        expect(log2[0], 'to equal', [10, 8, 10, 14]);
    });

    it("only calls the mapping function for each newly added item", function() {
        var sourceArray = ko.observableArray(sampleData.slice(0)),
        mapCallsCount = 0,
        mappedArray = sourceArray.map(function(item) { mapCallsCount++; return item.length; }),
        originalMappedArrayInstance = mappedArray(),
        log = [];
        mappedArray.subscribe(function(values) { log.push(values); });

        // Initially the mapping is run for each item
        expect(mappedArray(), 'to equal', [5, 4, 5]);
        expect(mapCallsCount, 'to be', 3);

        // On add, only the new item is mapped, and the output is the same array instance
        sourceArray.push('Another');
        expect(mappedArray(), 'to be', originalMappedArrayInstance);
        expect(mappedArray(), 'to equal', [5, 4, 5, 7]);
        expect(mapCallsCount, 'to be', 4);

        // Try multiple adds at once
        sourceArray.splice(2, 0, 'X', 'YZ');
        expect(mappedArray(), 'to equal', [5, 4, 1, 2, 5, 7]);
        expect(mapCallsCount, 'to be', 6);

        // On delete, doesn't need to map anything
        sourceArray.splice(2, 3);
        expect(mappedArray(), 'to equal', [5, 4, 7]);
        expect(mapCallsCount, 'to be', 6);

        // On move, doesn't need to map anything
        sourceArray(['Another', 'Beta']); // Delete 'Alpha', plus swap 'Another' and 'Beta'
        expect(mappedArray(), 'to equal', [7, 4]);
        expect(mapCallsCount, 'to be', 6);
    });

    it("responds to observable changes on individual items", function() {
        var prefix = ko.observable('');

        // Set up an array mapping in which individual items are observable
        var sourceArray = ko.observableArray([
            { name: 'Bert', age: ko.observable(123) },
            { name: 'Mollie', age: ko.observable(246) }
        ]),
        mapCallsCount = 0,
        mappedArray = sourceArray.map(function(item) {
            mapCallsCount++;
            return prefix() + item.name + ' is age ' + item.age();
        }),
        log = [];
        mappedArray.subscribe(function(values) { log.push(values); });
        expect(log.length, 'to be', 0);
        expect(mapCallsCount, 'to be', 2);
        expect(mappedArray(), 'to equal', ['Bert is age 123', 'Mollie is age 246']);

        // Mutate one of the original items; see it affect the output
        sourceArray()[0].age(555);
        expect(log.length, 'to be', 1);
        expect(mapCallsCount, 'to be', 3);
        expect(mappedArray(), 'to equal', ['Bert is age 555', 'Mollie is age 246']);

        // Add a new item
        var megatron = { name: 'Megatron', age: ko.observable(6) };
        sourceArray.push(megatron);
        expect(log.length, 'to be', 2);
        expect(mapCallsCount, 'to be', 4);
        expect(mappedArray(), 'to equal', ['Bert is age 555', 'Mollie is age 246', 'Megatron is age 6']);

        // Mutate it; see it affect the output
        megatron.age(7);
        expect(log.length, 'to be', 3);
        expect(mapCallsCount, 'to be', 5);
        expect(mappedArray(), 'to equal', ['Bert is age 555', 'Mollie is age 246', 'Megatron is age 7']);

        // Mutate all items at once
        prefix('person: ');
        expect(log.length, 'to be', 6);
        expect(mapCallsCount, 'to be', 8);
        expect(mappedArray(), 'to equal', ['person: Bert is age 555', 'person: Mollie is age 246', 'person: Megatron is age 7']);
    });

    it("supplies an observable index value that can be read in mappings", function() {
        var sourceArray = ko.observableArray(['Alpha', 'Beta']),
        mapCallsCount = 0,
        mappedArray = sourceArray.map(function(item, index) {
            mapCallsCount++;
            return "Item " + index() + " is " + item;
        });
        expect(mappedArray(), 'to equal', ['Item 0 is Alpha', 'Item 1 is Beta']);
        expect(mapCallsCount, 'to be', 2);

        // Check the index is given to newly-added items
        sourceArray.push('Gamma');
        expect(mappedArray(), 'to equal', ['Item 0 is Alpha', 'Item 1 is Beta', 'Item 2 is Gamma']);
        expect(mapCallsCount, 'to be', 3); // One new item

        // Check that indexes are updated when item positions are affected by deletions before them
        sourceArray.remove('Beta');
        expect(mappedArray(), 'to equal', ['Item 0 is Alpha', 'Item 1 is Gamma']);
        expect(mapCallsCount, 'to be', 4); // Re-mapped Gamma because index changed

        // Check that indexes are updated when item positions are affected by insertions before them
        sourceArray.splice(0, 0, 'First');
        expect(mappedArray(), 'to equal', ['Item 0 is First', 'Item 1 is Alpha', 'Item 2 is Gamma']);
        expect(mapCallsCount, 'to be', 7); // Mapped First (new) and remapped both others because indexes changed

        // Check that indexes are updated following a move
        sourceArray(['First', 'Gamma', 'Alpha']);
        expect(mappedArray(), 'to equal', ['Item 0 is First', 'Item 1 is Gamma', 'Item 2 is Alpha']);
        expect(mapCallsCount, 'to be', 9); // Remapped Alpha and Gamma because their indexes changed
    });

    it("excludes any mapped values that match the private exclusion marker", function() {
        // The private exclusion marker is only for use by the 'filter' function.
        // It's only required to work in cases where the mapping does *not* reference index at all
        // (and therefore items can't be included/excluded based on index, which wouldn't be meaningful)

        var alpha = { name: 'Alpha', age: ko.observable(100) },
        beta = { name: 'Beta', age: ko.observable(101) },
        gamma = { name: 'Gamma', age: ko.observable(102) },
        delta = { name: 'Delta', age: ko.observable(103) },
        epsilon = { name: 'Epsilon', age: ko.observable(104) },
        sourceArray = ko.observableArray([alpha, beta, gamma]),
        mapCallsCount = 0,
        mappedArray = sourceArray.map(function(item, index) {
            // Include only items with even age
            mapCallsCount++;
            return item.age() % 2 === 0 ? (index() + ': ' + item.name + ' is age ' + item.age()) : ko.transformations._exclusionMarker;
        });
        expect(mappedArray(), 'to equal', ['0: Alpha is age 100', '1: Gamma is age 102']);
        expect(mapCallsCount, 'to be', 3); // All items mapped

        // Indexes still correctly reflect the filtered result after an item mutates
        gamma.age(200);
        expect(mappedArray(), 'to equal', ['0: Alpha is age 100', '1: Gamma is age 200']);
        expect(mapCallsCount, 'to be', 4); // Remapped Gamma only

        // Filtering and indexes are preserved when items are retained
        sourceArray.valueHasMutated();
        expect(mappedArray(), 'to equal', ['0: Alpha is age 100', '1: Gamma is age 200']);
        expect(mapCallsCount, 'to be', 4); // Nothing needed to be remapped

        // The filter applies to newly-added items too
        sourceArray.splice(3, 0, delta, epsilon);
        expect(mappedArray(), 'to equal', ['0: Alpha is age 100', '1: Gamma is age 200', '2: Epsilon is age 104']);
        expect(mapCallsCount, 'to be', 6); // Mapped the two new items

        // Mutating an excluded item doesn't affect the output (assuming it stays excluded)
        beta.age(201);
        expect(mappedArray(), 'to equal', ['0: Alpha is age 100', '1: Gamma is age 200', '2: Epsilon is age 104']);
        expect(mapCallsCount, 'to be', 7); // Remapped Beta only

        // The filter updates in response to item changes
        beta.age(300);
        expect(mappedArray(), 'to equal', ['0: Alpha is age 100', '1: Beta is age 300', '2: Gamma is age 200', '3: Epsilon is age 104']);

        beta.age(301);
        expect(mappedArray(), 'to equal', ['0: Alpha is age 100', '1: Gamma is age 200', '2: Epsilon is age 104']);

        // The filter is respected after moves. Previous order is [alpha, beta, gamma, delta, epsilon]
        sourceArray([alpha, beta, epsilon, gamma, delta]);
        expect(mappedArray(), 'to equal', ['0: Alpha is age 100', '1: Epsilon is age 104', '2: Gamma is age 200']);

        // Note that in the above case, Delta isn't remapped at all, because last time its evaluator ran,
        // it returned the exclusion marker without even reading index(), so it has no dependency on index.
        // However, we can still bring it back and cause it to start responding to index changes:
        delta.age(500);
        expect(mappedArray(), 'to equal', ['0: Alpha is age 100', '1: Epsilon is age 104', '2: Gamma is age 200', '3: Delta is age 500']);

        // Try an arbitrary more complex combination of moves too
        sourceArray([gamma, beta, alpha, delta, epsilon]);
        expect(mappedArray(), 'to equal', ['0: Gamma is age 200', '1: Alpha is age 100', '2: Delta is age 500', '3: Epsilon is age 104']);

        // Try deleting an item that was already filtered out
        sourceArray.splice(1, 1);
        expect(mappedArray(), 'to equal', ['0: Gamma is age 200', '1: Alpha is age 100', '2: Delta is age 500', '3: Epsilon is age 104']);
    });

    it("disposes subscriptions when items are removed, and when the whole thing is disposed", function() {
        // Set up an array mapping in which individual items are observable
        var bert = { name: 'Bert', age: ko.observable(123) },
        mollie = { name: 'Mollie', age: ko.observable(246) },
        sourceArray = ko.observableArray([bert, mollie]),
        mappedArray = sourceArray.map(function(item) {
            return item.name + ' is age ' + item.age();
        });
        expect(mappedArray(), 'to equal', ['Bert is age 123', 'Mollie is age 246']);
        expect(bert.age.getSubscriptionsCount(), 'to be', 1);
        expect(mollie.age.getSubscriptionsCount(), 'to be', 1);

        // One internal 'change' subscription needed to implement array change tracking,
        // plus one 'arrayChange' subscription needed for the mapping, so two in total.
        expect(sourceArray.getSubscriptionsCount(), 'to be', 2);

        // Removing an item from the array disposes any mapping subscription held for that item
        sourceArray.remove(bert);
        expect(sourceArray.getSubscriptionsCount(), 'to be', 2);
        expect(bert.age.getSubscriptionsCount(), 'to be', 0);
        expect(mollie.age.getSubscriptionsCount(), 'to be', 1);

        // Disposing the entire mapped array disposes everything
        mappedArray.dispose();
        expect(bert.age.getSubscriptionsCount(), 'to be', 0);
        expect(mollie.age.getSubscriptionsCount(), 'to be', 0);

        // KO core's internal 'change' subscription for trackArrayChanges is not disposed (but will be
        // GCed when the array itself is). A possible future optimization for KO core would be to
        // remove/re-add trackArrayChanges based on whether num(trackArrayChange subscriptions) is zero.
        expect(sourceArray.getSubscriptionsCount(), 'to be', 1);
    });

    it("is possible to nest mappings", function() {
        var sourceArray = ko.observableArray([
            { id: 1, items: ko.observableArray(['Alpha', 'Beta', 'Gamma']) },
            { id: 2, items: ko.observableArray(['Delta']) },
            { id: 3, items: ko.observableArray([]) }
        ]),
        outerMappingsCallCount = 0,
        innerMappingsCallCount = 0,
        mappedArray = sourceArray.map(function(data) {
            outerMappingsCallCount++;
            return {
                id2: data.id,
                things: data.items.map(function(item) {
                    innerMappingsCallCount++;
                    return { name: item };
                })
            }
        });

        expect(ko.toJS(mappedArray()), 'to equal', [
            { id2: 1, things: [{ name: 'Alpha' }, { name: 'Beta' }, { name: 'Gamma' }] },
            { id2: 2, things: [{ name: 'Delta' }] },
            { id2: 3, things: [] }
        ]);
        expect(outerMappingsCallCount, 'to be', 3);
        expect(innerMappingsCallCount, 'to be', 4);

        // Can mutate an inner item without causing re-mapping of outer items
        sourceArray()[1].items.push('Epsilon');
        expect(ko.toJS(mappedArray()), 'to equal', [
            { id2: 1, things: [{ name: 'Alpha' }, { name: 'Beta' }, { name: 'Gamma' }] },
            { id2: 2, things: [{ name: 'Delta' }, { name: 'Epsilon' }] },
            { id2: 3, things: [] }
        ]);
        expect(outerMappingsCallCount, 'to be', 3);
        expect(innerMappingsCallCount, 'to be', 5);

        // Can mutate an outer item and only cause re-mapping of its children
        sourceArray.splice(1, 1, { id: 'new', items: ko.observableArray(['NewChild1', 'NewChild2']) });
        expect(ko.toJS(mappedArray()), 'to equal', [
            { id2: 1, things: [{ name: 'Alpha' }, { name: 'Beta' }, { name: 'Gamma' }] },
            { id2: 'new', things: [{ name: 'NewChild1' }, { name: 'NewChild2' }] },
            { id2: 3, things: [] }
        ]);
        expect(outerMappingsCallCount, 'to be', 4);
        expect(innerMappingsCallCount, 'to be', 7);
    });

    it("is possible to provide a 'disposeItem' option to clear up the mapped object", function() {
        var modelItem = {
            name: ko.observable('Annie')
        },
        underlyingArray = ko.observableArray(),
        disposedItems = [],
        mappedArray = underlyingArray.map({
            mapping: function(item) {
                return {
                    nameUpper: ko.computed(function() {
                        return item.name().toUpperCase();
                    })
                };
            },
            disposeItem: function(mappedItem) {
                disposedItems.push(mappedItem.nameUpper());
                mappedItem.nameUpper.dispose();
            }
        });

        // See that each mapped item causes a subscription on the underlying observable
        expect(modelItem.name.getSubscriptionsCount(), 'to be', 0);
        underlyingArray.push(modelItem);
        underlyingArray.push(modelItem);
        expect(modelItem.name.getSubscriptionsCount(), 'to be', 2);

        // See that removing items causes subscriptions to be disposed
        underlyingArray.pop();
        expect(modelItem.name.getSubscriptionsCount(), 'to be', 1);
        expect(disposedItems, 'to equal', ['ANNIE']);

        // See that mutating the observable doesn't affect its subscription count
        modelItem.name('Clarabel');
        expect(ko.toJS(mappedArray), 'to equal', [{ nameUpper: 'CLARABEL' }]);
        expect(modelItem.name.getSubscriptionsCount(), 'to be', 1);

        // See that disposing the whole mapped array also triggers the disposeItem callbacks
        mappedArray.dispose();
        expect(modelItem.name.getSubscriptionsCount(), 'to be', 0);
        expect(disposedItems, 'to equal', ['ANNIE', 'CLARABEL']);
    });

    it("calls 'disposeItem' when items are being replaced in-place", function() {
        var modelItem1 = { name: ko.observable('Annie') },
        modelItem2 = { name: ko.observable('Clarabel') },
        underlyingArray = ko.observableArray(),
        disposedItemsIndices = [],
        mappedItemNextIndex = 0,
        mappedArray = underlyingArray.map({
            mapping: function(item) {
                // Notice there is no extra layer of observability here
                // (no ko.computed), so when 'name' changes, this entire
                // mapped entry has to get replaced.
                return { nameUpper: item.name().toUpperCase(), mappedItemIndex: mappedItemNextIndex++ };
            },
            disposeItem: function(mappedItem) {
                disposedItemsIndices.push(mappedItem.mappedItemIndex);
            }
        });

        underlyingArray.push(modelItem1);
        underlyingArray.push(modelItem2);
        expect(mappedArray(), 'to equal', [
            { nameUpper: 'ANNIE', mappedItemIndex: 0 },
            { nameUpper: 'CLARABEL', mappedItemIndex: 1 }
        ]);
        expect(disposedItemsIndices, 'to equal', []);

        // See that replacing in-place causes disposeItem to fire
        modelItem2.name('ClarabelMutated');
        expect(mappedArray(), 'to equal', [
            { nameUpper: 'ANNIE', mappedItemIndex: 0 },
            { nameUpper: 'CLARABELMUTATED', mappedItemIndex: 2 }
        ]);
        expect(disposedItemsIndices, 'to equal', [1]);

        // See that reordering does not trigger any disposeItem calls
        underlyingArray.reverse();
        expect(mappedArray(), 'to equal', [
            { nameUpper: 'CLARABELMUTATED', mappedItemIndex: 2 },
            { nameUpper: 'ANNIE', mappedItemIndex: 0 }
        ]);
        expect(disposedItemsIndices, 'to equal', [1]);

        // See that actual removal does trigger a disposeItem call
        underlyingArray.shift();
        expect(mappedArray(), 'to equal', [
            { nameUpper: 'ANNIE', mappedItemIndex: 0 }
        ]);
        expect(disposedItemsIndices, 'to equal', [1, 2]);
    });

    it("is possible to provide a 'mappingWithDisposeCallback' option to combine both 'mapping' and 'disposeItem' in one", function() {
        // If you 'mapping' callback wants to create some per-item resource that needs disposal,
        // but that item is not the mapping result itself, then you would struggle to implement
        // the disposal because 'disposeItem' only gives you the mapping result, and not any
        // other context that helps you find the other per-item resource you created.
        // To solve this, 'mappingWithDisposeCallback' is an alternative to 'mapping'. Your return
        // value should be an object of the form { mappedValue: ..., dispose: function() { ... } },
        // and then the 'dispose' callback will be invoked when the mappedValue should be disposed.

        var underlyingArray = ko.observableArray([
            { name: ko.observable('alpha') },
            { name: ko.observable('beta') },
            { name: ko.observable('gamma') }
        ]),
        alphaObject = underlyingArray()[0],
        perItemResources = {},
        mappedArray = underlyingArray.map({
            mappingWithDisposeCallback: function(value, index) {
                var name = value.name();
                perItemResources[name] = { disposed: false };

                return {
                    mappedValue: name.toUpperCase(),
                    dispose: function() { perItemResources[name].disposed = true; }
                };
            }
        });

        expect(mappedArray(), 'to equal', ['ALPHA', 'BETA', 'GAMMA']);
        expect(perItemResources, 'to equal', {
            alpha: { disposed: false },
            beta: { disposed: false },
            gamma: { disposed: false }
        });

        // See that removal triggers the per-item dispose callback
        underlyingArray.splice(1, 1);
        expect(mappedArray(), 'to equal', ['ALPHA', 'GAMMA']);
        expect(perItemResources, 'to equal', {
            alpha: { disposed: false },
            beta: { disposed: true },
            gamma: { disposed: false }
        });

        // See that reordering does not trigger the per-item dispose callback
        underlyingArray.reverse();
        expect(mappedArray(), 'to equal', ['GAMMA', 'ALPHA']);
        expect(perItemResources, 'to equal', {
            alpha: { disposed: false },
            beta: { disposed: true },
            gamma: { disposed: false }
        });

        // See that replace-in-place does trigger the per-item dispose callback
        alphaObject.name('replaced');
        expect(mappedArray(), 'to equal', ['GAMMA', 'REPLACED']);
        expect(perItemResources, 'to equal', {
            alpha: { disposed: true },
            beta: { disposed: true },
            gamma: { disposed: false },
            replaced: { disposed: false }
        });
    });

    it("will attempt to disposed mapped items on every evaluation, even if the evaluator returns the same object instances each time", function() {
        // It would be unusual to have a mapping evaluator that returns the same object instances each time
        // it is called, but if you do that, we will still tell you to dispose the item before every evaluation
        var underlyingArray = ko.observableArray([1, 2, 3]),
        constantMappedValue = { theMappedValue: true },
        disposeCount = 0,
        mappedArray = underlyingArray.map({
            mappingWithDisposeCallback: function(item) {
                return {
                    mappedValue: constantMappedValue,
                    dispose: function() {
                        disposeCount++;
                    }
                }
            }
        });

        expect(mappedArray(), 'to equal', [constantMappedValue, constantMappedValue, constantMappedValue]);
        expect(disposeCount, 'to equal', 0);

        // Adding items doesn't trigger disposal
        underlyingArray.push(4);
        expect(mappedArray(), 'to equal', [constantMappedValue, constantMappedValue, constantMappedValue, constantMappedValue]);
        expect(disposeCount, 'to equal', 0);

        // Removing items does
        underlyingArray.splice(1, 2);
        expect(mappedArray(), 'to equal', [constantMappedValue, constantMappedValue]);
        expect(disposeCount, 'to equal', 2);

        // Reordering items does not
        underlyingArray.reverse();
        expect(mappedArray(), 'to equal', [constantMappedValue, constantMappedValue]);
        expect(disposeCount, 'to equal', 2);

        // Replacing items does
        underlyingArray([5, 6]);
        expect(mappedArray(), 'to equal', [constantMappedValue, constantMappedValue]);
        expect(disposeCount, 'to equal', 4);

        // Disposing the entire mapped array does
        mappedArray.dispose();
        expect(mappedArray(), 'to equal', [constantMappedValue, constantMappedValue]);
        expect(disposeCount, 'to equal', 6);
    });

    it('supports a throttle option', function () {
        var underlyingArray = ko.observableArray([1, 2, 3]);

        var factor = ko.observable(1);
        var mappedArray = underlyingArray.map({
            mapping: function (x) {
                return x * factor();
            },
            throttle: 200
        });
        var spy = sinon.spy();
        mappedArray.subscribe(spy);

        expect(mappedArray(), 'to equal', underlyingArray());

        factor(5);
        expect(spy, 'was not called');

        clock.tick(201);

        expect(spy, 'was called once');

        expect(mappedArray(), 'to equal', [5, 10, 15]);
    });

    it("is mandatory to specify 'mapping' or 'mappingWithDisposeCallback'", function() {
        var underlyingArray = ko.observableArray([1, 2, 3]);

        expect(function() {
            underlyingArray.map({ /* empty options */ });
        }, 'to throw', "Specify either 'mapping' or 'mappingWithDisposeCallback'.");
    });

    it("is not allowed to specify 'mappingWithDisposeCallback' in conjunction with 'mapping' or 'disposeItem'", function() {
        var underlyingArray = ko.observableArray([1, 2, 3]);

        expect(function() {
            underlyingArray.map({
                mapping: function() {  },
                mappingWithDisposeCallback: function() {  }
            });
        }, 'to throw', "'mappingWithDisposeCallback' cannot be used in conjunction with 'mapping' or 'disposeItem'.");

        expect(function() {
            underlyingArray.map({
                disposeItem: function() {  },
                mappingWithDisposeCallback: function() {  }
            });
        }, 'to throw', "'mappingWithDisposeCallback' cannot be used in conjunction with 'mapping' or 'disposeItem'.");
    });
});
