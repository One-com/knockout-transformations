var ko = require('../lib/filter.js');
var expect = require('unexpected').clone()
    .installPlugin(require('unexpected-sinon'));
var sinon = require('sinon');

describe("Filter", function () {
    var clock;

    beforeEach(function () {
        clock = sinon.useFakeTimers();
    });

    afterEach(function () {
        clock.restore();
    });

    var makeSampleData = function () {
        var sampleData = {
            everest: { height: ko.observable(8848) },
            aconcagua: { height: ko.observable(6961) },
            mckinley: { height: ko.observable(6194) },
            kilimanjaro: { height: ko.observable(5895) },
            elbrus: { height: ko.observable(5642) },
            vinson: { height: ko.observable(4892) },
            puncakjaya: { height: ko.observable(4884) }
        };
        sampleData.all = [sampleData.everest, sampleData.aconcagua, sampleData.mckinley, sampleData.kilimanjaro, sampleData.elbrus, sampleData.vinson, sampleData.puncakjaya];
        return sampleData;
    };

    it("returns a readonly computed observable array", function () {
        var sampleData = makeSampleData(),
        sourceArray = ko.observableArray(sampleData.all),
        filteredArray = sourceArray.filter(function (item) { return true; });

        expect(ko.isObservable(filteredArray), 'to be', true);
        expect(ko.isComputed(filteredArray), 'to be', true);
        expect(function () { filteredArray([1, 2, 3]); }, 'to throw',
               "Cannot write a value to a ko.computed unless you specify a 'write' option. If you wish to read the current value, don't pass any parameters.");
    });

    it("filters the input array using the predicate", function () {
        var sampleData = makeSampleData(),
        sourceArray = ko.observableArray(sampleData.all),
        filteredArray = sourceArray.filter(function (item) { return item.height() > 6000; });

        // Check we have the original instances
        expect(filteredArray().length, 'to be', 3);
        expect(filteredArray()[0], 'to be', sampleData.everest);
        expect(filteredArray()[1], 'to be', sampleData.aconcagua);
        expect(filteredArray()[2], 'to be', sampleData.mckinley);
    });

    it("responds to changes in the input data, but retains the same output array instance", function () {
        var sampleData = makeSampleData(),
        sourceArray = ko.observableArray(sampleData.all),
        filteredArray = sourceArray.filter(function (item) { return item.height() > 6000; }),
        originalFilteredArrayInstance = filteredArray();
        expect(filteredArray(), 'to equal', [sampleData.everest, sampleData.aconcagua, sampleData.mckinley]);

        // Make a change to include an item
        sampleData.vinson.height(10000);
        expect(filteredArray(), 'to equal', [sampleData.everest, sampleData.aconcagua, sampleData.mckinley, sampleData.vinson]);
        expect(filteredArray(), 'to be', originalFilteredArrayInstance);

        // Exclude some other
        sampleData.everest.height(23);
        expect(filteredArray(), 'to equal', [sampleData.aconcagua, sampleData.mckinley, sampleData.vinson]);
    });

    it("is possible to chain filters", function () {
        var sampleData = makeSampleData(),
        sourceArray = ko.observableArray(sampleData.all),
        tallOnes = sourceArray.filter(function (item) { return item.height() > 5000; }),
        heightsOfTallOnes = tallOnes.map(function (item) { return item.height(); }),
        evenHeightsOfTallOnes = heightsOfTallOnes.filter(function (height) { return height % 2 === 0; });

        expect(tallOnes(), 'to equal', [sampleData.everest, sampleData.aconcagua, sampleData.mckinley, sampleData.kilimanjaro, sampleData.elbrus]);
        expect(heightsOfTallOnes(), 'to equal', [8848, 6961, 6194, 5895, 5642]);
        expect(evenHeightsOfTallOnes(), 'to equal', [8848, 6194, 5642]);

        // See that changes ripple through - make a new item appear
        sampleData.puncakjaya.height(10000);
        expect(tallOnes(), 'to equal', [sampleData.everest, sampleData.aconcagua, sampleData.mckinley, sampleData.kilimanjaro, sampleData.elbrus, sampleData.puncakjaya]);
        expect(heightsOfTallOnes(), 'to equal', [8848, 6961, 6194, 5895, 5642, 10000]);
        expect(evenHeightsOfTallOnes(), 'to equal', [8848, 6194, 5642, 10000]);

        // Make one disappear
        sampleData.everest.height(2);
        expect(tallOnes(), 'to equal', [sampleData.aconcagua, sampleData.mckinley, sampleData.kilimanjaro, sampleData.elbrus, sampleData.puncakjaya]);
        expect(heightsOfTallOnes(), 'to equal', [6961, 6194, 5895, 5642, 10000]);
        expect(evenHeightsOfTallOnes(), 'to equal', [6194, 5642, 10000]);
    });

    it("only runs the filter predicate for items affected by a change", function () {
        var sampleData = makeSampleData(),
        sourceArray = ko.observableArray(sampleData.all),
        filterCallsCount = 0,
        veryTallOnes = sourceArray.filter(function (item) {
            filterCallsCount += 1;
            return item.height() > 6000;
        });

        expect(veryTallOnes(), 'to equal', [sampleData.everest, sampleData.aconcagua, sampleData.mckinley]);
        expect(filterCallsCount, 'to be', 7); // All were filtered

        // Add one item
        var newItem = { height: ko.observable(10000) };
        sourceArray.push(newItem);
        expect(veryTallOnes(), 'to equal', [sampleData.everest, sampleData.aconcagua, sampleData.mckinley, newItem]);
        expect(filterCallsCount, 'to be', 8); // Only new item was filtered

        // Remove one item
        sourceArray.remove(sampleData.aconcagua);
        expect(veryTallOnes(), 'to equal', [sampleData.everest, sampleData.mckinley, newItem]);
        expect(filterCallsCount, 'to be', 8); // No additional filter calls were required
    });

    it("only issues notifications when some inclusion status has actually changed", function () {
        var sampleData = makeSampleData(),
        sourceArray = ko.observableArray(sampleData.all),
        outputNotifications = 0,
        veryTallOnes = sourceArray.filter(function (item) {
            return item.height() > 6000;
        });
        veryTallOnes.subscribe(function () {
            outputNotifications += 1;
        });
        expect(veryTallOnes(), 'to equal', [sampleData.everest, sampleData.aconcagua, sampleData.mckinley]);

        // Mutate one to make it become excluded
        sampleData.everest.height(10);
        expect(outputNotifications, 'to be', 1);
        expect(veryTallOnes(), 'to equal', [sampleData.aconcagua, sampleData.mckinley]);

        // Mutate one to make it become included
        sampleData.puncakjaya.height(10000);
        expect(outputNotifications, 'to be', 2);
        expect(veryTallOnes(), 'to equal', [sampleData.aconcagua, sampleData.mckinley, sampleData.puncakjaya]);

        // Mutate an included one in such a way that it remains included
        sampleData.mckinley.height(12345);
        expect(outputNotifications, 'to be', 2); // No new notifications

        // Mutate an excluded one in such a way that it remains excluded
        sampleData.everest.height(123);
        expect(outputNotifications, 'to be', 2); // No new notifications
    });

    it('supports a throttle option', function () {
        var underlyingArray = ko.observableArray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

        var modulus = ko.observable(1);
        var filteredArray = underlyingArray.filter({
            mapping: function (x) {
                return x % modulus() === 0;
            },
            throttle: 200
        });
        var spy = sinon.spy();
        filteredArray.subscribe(spy);

        expect(filteredArray(), 'to equal', underlyingArray());
        modulus(3);
        expect(spy, 'was not called');

        clock.tick(201);

        expect(spy, 'was called once');

        expect(filteredArray(), 'to equal', [0, 3, 6, 9]);
    });

    describe('group inclussion example', function () {
        var persons, groups, person;

        function Person(id) {
            var that = this;
            this.id = id;
            this.groups = groups.filter(function (group) {
                return group.contains(that);
            });
        }

        function Group(ids) {
            this.ids = ko.observableArray(ids);
            this.members = this.ids.map(function (id) {
                return persons().filter(function (person) {
                    return person.id === id;
                })[0];
            });
        }

        Group.prototype.contains = function (member) {
            return this.ids.indexOf(member.id) !== -1;
        };

        Group.prototype.add = function (member) {
            if (!this.contains(member)) {
                this.ids.push(member.id);
            }
        };

        Group.prototype.remove = function (member) {
            if (this.contains(member)) {
                this.ids.remove(member.id);
            }
        };

        beforeEach(function () {
            persons = ko.observableArray([]);
            groups = ko.observableArray([]);
            for (var id = 0; id < 10; id += 1) {
                persons.push(new Person(id));
            }
            groups([
                new Group([0, 1, 2]),
                new Group([2, 3, 4, 5, 6]),
                new Group([5, 6, 7, 8, 9])
            ]);
            person = persons()[5];
        });

        it('group membership is initialized correctly', function () {
            expect(person.groups(), 'to equal', groups.slice(1));
            expect(groups()[0].members(), 'not to contain', person);
            expect(groups()[1].members(), 'to contain', person);
            expect(groups()[2].members(), 'to contain', person);
        });

        it('group membership is updated correctly when the person is added to an existing group', function () {
            groups()[0].add(person);
            expect(person.groups(), 'to equal', groups());
            expect(groups()[0].members(), 'to contain', person);
            expect(groups()[1].members(), 'to contain', person);
            expect(groups()[2].members(), 'to contain', person);
        });

        it('group membership is updated correctly when the person is removed from a group', function () {
            groups()[1].remove(person);
            expect(person.groups(), 'to equal', groups.slice(2));
            expect(groups()[0].members(), 'not to contain', person);
            expect(groups()[1].members(), 'not to contain', person);
            expect(groups()[2].members(), 'to contain', person);
        });

        it('group membership is updated correctly when the person is added to a new group', function () {
            groups.push(new Group());
            groups()[groups().length - 1].add(person);
            expect(person.groups(), 'to equal', groups.slice(1));
            expect(groups()[0].members(), 'not to contain', person);
            expect(groups()[1].members(), 'to contain', person);
            expect(groups()[2].members(), 'to contain', person);
            expect(groups()[3].members(), 'to contain', person);
        });
    });
});
