var ko = require('knockout');
var expect = require('unexpected').clone()
    .installPlugin(require('unexpected-sinon'))
    .installPlugin(require('unexpected-knockout'));
var sinon = require('sinon');

require('../lib/indexBy.js');

function Person(name, yearOfBirth) {
    this.name = ko.observable(name);
    this.yearOfBirth = ko.observable(yearOfBirth);
}

expect.addType({
    name: 'Person',
    base: 'object',
    identify: function (value) {
        return value instanceof Person;
    },
    inspect: function (value, depth, output) {
        output.text(value.yearOfBirth() + ' ' + value.name());
    }
});


expect.addAssertion('to contain items for key', function (expect, subject, key, itemNames) {
    var actualNames = subject()[key].map(function (item) {
        return item && item.name;
    }).sort();
    var expectedNames = [].concat(itemNames).sort();
    this.errorMode = 'nested';
    expect(actualNames, 'to equal', expectedNames);
});

describe("IndexBy", function () {
    var clock;

    beforeEach(function () {
        clock = sinon.useFakeTimers();
    });

    afterEach(function () {
        clock.restore();
    });

    describe('on an empty array', function () {
        var sampleData, sourceArray, indexedData;
        beforeEach(function () {
            sampleData = [];
            sourceArray = ko.observableArray(sampleData);
            indexedData = sourceArray.indexBy(function (item) {
                return item;
            });
        });

        it('results in an empty map', function () {
            expect(indexedData(), 'to equal', {});
        });
    });

    describe('on simple data', function () {
        var sampleData, sourceArray, indexedData;

        beforeEach(function () {
            sampleData = ['Beta', 'Beta', 'Gamma', 'Alpha'];
            sourceArray = ko.observableArray(sampleData);
            indexedData = sourceArray.indexBy(function (item) { return item; })();
        });

        it("indexes the array according to the given function, returning a computed map", function () {
            expect(indexedData, 'to equal', {
                'Alpha': ['Alpha'],
                'Beta': ['Beta', 'Beta'],
                'Gamma': ['Gamma']
            });
        });

        it('updates the index on unshift', function () {
            sourceArray.unshift('Foo', 'Bar');
            expect(indexedData, 'to equal', {
                'Alpha': ['Alpha'],
                'Beta': ['Beta', 'Beta'],
                'Gamma': ['Gamma'],
                'Foo': ['Foo'],
                'Bar': ['Bar']
            });
        });

        it('updates the index on push', function () {
            sourceArray.push('Foo', 'Bar', 'Beta');
            expect(indexedData, 'to equal', {
                'Alpha': ['Alpha'],
                'Beta': ['Beta', 'Beta', 'Beta'],
                'Gamma': ['Gamma'],
                'Foo': ['Foo'],
                'Bar': ['Bar']
            });
        });

        it('updates the index on splice', function () {
            sourceArray.splice(3, 0, 'Foo', 'Bar');
            expect(indexedData, 'to equal', {
                'Alpha': ['Alpha'],
                'Beta': ['Beta', 'Beta'],
                'Gamma': ['Gamma'],
                'Foo': ['Foo'],
                'Bar': ['Bar']
            });
        });

        it('updates the index on replacing with splice', function () {
            sourceArray.splice(1, 2, 'Foo', 'Bar');
            expect(indexedData, 'to equal', {
                'Alpha': ['Alpha'],
                'Beta': ['Beta'],
                'Foo': ['Foo'],
                'Bar': ['Bar']
            });
        });

        it('updates the index on pop', function () {
            sourceArray.pop();
            expect(indexedData, 'to equal', {
                'Beta': ['Beta', 'Beta'],
                'Gamma': ['Gamma']
            });
        });

        it('updates the index on shift', function () {
            sourceArray.shift();
            expect(indexedData, 'to equal', {
                'Alpha': ['Alpha'],
                'Beta': ['Beta'],
                'Gamma': ['Gamma']
            });
        });

        it('does not change the index when the data is reversed', function () {
            sourceArray.reverse();
            expect(indexedData, 'to equal', {
                'Alpha': ['Alpha'],
                'Beta': ['Beta', 'Beta'],
                'Gamma': ['Gamma']
            });
        });

        it('does not change the index when the data is sort', function () {
            sourceArray.sort();
            expect(indexedData, 'to equal', {
                'Alpha': ['Alpha'],
                'Beta': ['Beta', 'Beta'],
                'Gamma': ['Gamma']
            });
        });
    });

    describe('on complex data', function () {
        var sampleData, sourceArray, indexedData, expectedIndex;
        var queenVictoria, johnMKeynes;

        beforeEach(function () {
            queenVictoria = new Person("Queen Victoria", 1819);
            johnMKeynes = new Person("John M Keynes", 1883);

            sampleData = [
                new Person("Marilyn Monroe", 1926),
                new Person("Abraham Lincoln", 1809),
                new Person("Mother Teresa", 1910),
                new Person("John F. Kennedy", 1917),
                new Person("Martin Luther King", 1929),
                new Person("Nelson Mandela", 1918),
                new Person("Winston Churchill", 1874),
                new Person("Bill Gates", 1955),
                new Person("Muhammad Ali", 1942),
                new Person("Mahatma Gandhi", 1869),
                new Person("Margaret Thatcher", 1925),
                new Person("Charles de Gaulle", 1890),
                new Person("Christopher Columbus", 1451),
                new Person("George Orwell", 1903),
                new Person("Charles Darwin", 1809),
                new Person("Elvis Presley", 1935),
                new Person("Albert Einstein", 1879),
                new Person("Paul McCartney", 1942),
                new Person("Plato", 423),
                new Person("Plato", 427),
                new Person("Queen Elizabeth II", 1926)
            ];

            expectedIndex = {};
            ko.utils.arrayForEach(sampleData, function (person) {
                expectedIndex[person.name()] = expectedIndex[person.name()] || [];
                expectedIndex[person.name()].push(person);
            });

            sourceArray = ko.observableArray(sampleData);
            indexedData = sourceArray.indexBy(function (person) {
                return person.name();
            })();
        });

        it("indexes the array according to the given function, returning a computed map", function () {
            expect(indexedData, 'to equal', expectedIndex);
        });

        it('updates the index on unshift', function () {
            sourceArray.unshift(queenVictoria, johnMKeynes);

            expectedIndex[queenVictoria.name()] = [queenVictoria];
            expectedIndex[johnMKeynes.name()] = [johnMKeynes];
            expect(indexedData, 'to equal', expectedIndex);
        });

        it('updates the index on push', function () {
            sourceArray.push(queenVictoria, johnMKeynes);

            expectedIndex[queenVictoria.name()] = [queenVictoria];
            expectedIndex[johnMKeynes.name()] = [johnMKeynes];
            expect(indexedData, 'to equal', expectedIndex);
        });

        it('updates the index on splice', function () {
            sourceArray.splice(3, 0, queenVictoria, johnMKeynes);

            expectedIndex[queenVictoria.name()] = [queenVictoria];
            expectedIndex[johnMKeynes.name()] = [johnMKeynes];
            expect(indexedData, 'to equal', expectedIndex);
        });

        it('updates the index on replacing with splice', function () {
            delete expectedIndex[sampleData[3].name()];
            delete expectedIndex[sampleData[4].name()];

            sourceArray.splice(3, 2, queenVictoria, johnMKeynes);

            expectedIndex[queenVictoria.name()] = [queenVictoria];
            expectedIndex[johnMKeynes.name()] = [johnMKeynes];
            expect(indexedData, 'to equal', expectedIndex);
        });

        it('updates the index on pop', function () {
            delete expectedIndex[sampleData[sampleData.length - 1].name()];
            sourceArray.pop();
            expect(indexedData, 'to equal', expectedIndex);
        });

        it('updates the index on shift', function () {
            delete expectedIndex[sampleData[0].name()];
            sourceArray.shift();
            expect(indexedData, 'to equal', expectedIndex);
        });

        it('does not change the index when the data is reversed', function () {
            sourceArray.reverse();
            expect(indexedData, 'to equal', expectedIndex);
        });

        it('does not change the index when the data is sort', function () {
            sourceArray.sort();
            expect(indexedData, 'to equal', expectedIndex);
        });

        it('updates the index when a sort key changes', function () {
            var nameBeforeChange = sampleData[3].name.peek();
            expectedIndex['Jesus Christ'] = [sampleData[3]];
            delete expectedIndex[nameBeforeChange];

            sampleData[3].name('Jesus Christ');

            expect(indexedData, 'to equal', expectedIndex);
        });

        describe('on multiple keys', function () {
            it("indexes the array according to the given function, returning a computed map", function () {
                indexedData = sourceArray.indexBy(function (person) {
                    return [person.name(), person.yearOfBirth()];
                })();

                expectedIndex = {};
                ko.utils.arrayForEach(sampleData, function (person) {
                    expectedIndex[person.name()] = expectedIndex[person.name()] || [];
                    expectedIndex[person.name()].push(person);

                    expectedIndex[person.yearOfBirth()] = expectedIndex[person.yearOfBirth()] || [];
                    expectedIndex[person.yearOfBirth()].push(person);
                });
                expect(indexedData, 'to equal', expectedIndex);
            });

            describe('handling a many-to-many relation', function () {
                var sampleData, sourceArray, indexedData;
                beforeEach(function () {
                    sampleData = [
                        {
                            name: 'Alpha',
                            connections: ko.observableArray([ 1, 2, 3 ])
                        },
                        {
                            name: 'Beta',
                            connections: ko.observableArray([ 1, 3 ])
                        },
                        {
                            name: 'Gamma',
                            connections: ko.observableArray([ 2, 4 ])
                        },
                        {
                            name: 'Delta',
                            connections: ko.observableArray([ 1, 3, 4 ])
                        }
                    ];
                    sourceArray = ko.observableArray(sampleData);
                    indexedData = sourceArray.indexBy(function (item) {
                        return item.connections();
                    });
                });

                it('updates the array when an item is added to the source array', function () {
                    sourceArray.push({
                        name: 'Epsilon',
                        connections: ko.observableArray([ 1, 4 ])
                    });
                    expect(indexedData, 'to contain items for key', 4, [
                        'Gamma', 'Delta', 'Epsilon'
                    ]);
                });

                it('updates the array when an item is deleted from the source array', function () {
                    sourceArray.remove(sampleData[3]);
                    expect(indexedData, 'to contain items for key', 4, [
                        'Gamma'
                    ]);
                });

                it('updates the array when a key is added to an item in the source array', function () {
                    sampleData[0].connections.push(4);
                    expect(indexedData, 'to contain items for key', 4, [
                        'Alpha', 'Gamma', 'Delta'
                    ]);
                });

                it('updates the array when a key is removed from an item in the source array', function () {
                    sampleData[3].connections.remove(4);
                    expect(indexedData, 'to contain items for key', 4, [
                        'Gamma'
                    ]);
                });
            });
        });
    });
});

describe("UniqueIndexBy", function () {
    var clock;

    beforeEach(function () {
        clock = sinon.useFakeTimers();
    });

    afterEach(function () {
        clock.restore();
    });

    describe('on an empty array', function () {
        var sampleData, sourceArray, indexedData;
        beforeEach(function () {
            sampleData = [];
            sourceArray = ko.observableArray(sampleData);
            indexedData = sourceArray.indexBy({
                unique: true,
                mapping: function (item) {
                    return item;
                }
            })();
        });

        it('results in an empty map', function () {
            expect(indexedData, 'to equal', {});
        });
    });

    describe('on simple data', function () {
        var sampleData, sourceArray, indexedData;

        beforeEach(function () {
            sampleData = ['Beta', 'Gamma', 'Alpha'];
            sourceArray = ko.observableArray(sampleData);
            indexedData = sourceArray.uniqueIndexBy(function (item) {
                return item;
            })();
        });

        it("indexes the array according to the given function, returning a computed map", function () {
            expect(indexedData, 'to equal', {
                'Alpha': 'Alpha',
                'Beta': 'Beta',
                'Gamma': 'Gamma'
            });
        });

        it('updates the index on unshift', function () {
            sourceArray.unshift('Foo', 'Bar');
            expect(indexedData, 'to equal', {
                'Alpha': 'Alpha',
                'Beta': 'Beta',
                'Gamma': 'Gamma',
                'Foo': 'Foo',
                'Bar': 'Bar'
            });
        });

        it('updates the index on push', function () {
            sourceArray.push('Foo', 'Bar');
            expect(indexedData, 'to equal', {
                'Alpha': 'Alpha',
                'Beta': 'Beta',
                'Gamma': 'Gamma',
                'Foo': 'Foo',
                'Bar': 'Bar'
            });
        });

        it('updates the index on splice', function () {
            sourceArray.splice(3, 0, 'Foo', 'Bar');
            expect(indexedData, 'to equal', {
                'Alpha': 'Alpha',
                'Beta': 'Beta',
                'Gamma': 'Gamma',
                'Foo': 'Foo',
                'Bar': 'Bar'
            });
        });

        it('updates the index on replacing with splice', function () {
            sourceArray.splice(1, 2, 'Foo', 'Bar');
            expect(indexedData, 'to equal', {
                'Beta': 'Beta',
                'Foo': 'Foo',
                'Bar': 'Bar'
            });
        });

        it('updates the index on pop', function () {
            sourceArray.pop();
            expect(indexedData, 'to equal', {
                'Beta': 'Beta',
                'Gamma': 'Gamma'
            });
        });

        it('updates the index on shift', function () {
            sourceArray.shift();
            expect(indexedData, 'to equal', {
                'Alpha': 'Alpha',
                'Gamma': 'Gamma'
            });
        });

        it('does not change the index when the data is reversed', function () {
            sourceArray.reverse();
            expect(indexedData, 'to equal', {
                'Alpha': 'Alpha',
                'Beta': 'Beta',
                'Gamma': 'Gamma'
            });
        });

        it('does not change the index when the data is sort', function () {
            sourceArray.sort();
            expect(indexedData, 'to equal', {
                'Alpha': 'Alpha',
                'Beta': 'Beta',
                'Gamma': 'Gamma'
            });
        });

        it('throw an error if multiple items maps to the same key', function () {
            expect(function () {
                sourceArray.push('Beta');
            }, 'to throw', 'Unique indexes requires items must map to different keys; duplicate key: Beta');
        });

        it.skip('handles reindexing on another field', function () {
            sampleData = ko.utils.arrayMap(sampleData, function (text, i) {
                return { first: text, next: sampleData[(i + 1) % sampleData.length] };
            });
            var indexField = ko.observable('first');
            sourceArray = ko.observableArray(sampleData);
            indexedData = sourceArray.uniqueIndexBy(function (item) {
                return item[indexField()];
            });

            expect(indexedData(), 'to equal', {
                'Alpha': { first: 'Alpha', next: 'Beta' },
                'Beta': { first: 'Beta', next: 'Gamma' },
                'Gamma': { first: 'Gamma', next: 'Alpha' }
            });

            indexField('next');

            expect(indexedData(), 'to equal', {
                'Beta': { first: 'Alpha', next: 'Beta' },
                'Gamma': { first: 'Beta', next: 'Gamma' },
                'Alpha': { first: 'Gamma', next: 'Alpha' }
            });
        });
    });

    describe('on complex data', function () {
        var sampleData, sourceArray, indexedData, expectedIndex;
        var queenVictoria, johnMKeynes;

        beforeEach(function () {
            queenVictoria = new Person("Queen Victoria", 1819);
            johnMKeynes = new Person("John M Keynes", 1883);

            sampleData = [
                new Person("Marilyn Monroe", 1926),
                new Person("Abraham Lincoln", 1809),
                new Person("Mother Teresa", 1910),
                new Person("John F. Kennedy", 1917),
                new Person("Martin Luther King", 1929),
                new Person("Nelson Mandela", 1918),
                new Person("Winston Churchill", 1874),
                new Person("Bill Gates", 1955),
                new Person("Muhammad Ali", 1942),
                new Person("Mahatma Gandhi", 1869),
                new Person("Margaret Thatcher", 1925),
                new Person("Charles de Gaulle", 1890),
                new Person("Christopher Columbus", 1451),
                new Person("George Orwell", 1903),
                new Person("Elvis Presley", 1935),
                new Person("Albert Einstein", 1879),
                new Person("Plato", 423)
            ];

            expectedIndex = {};
            ko.utils.arrayForEach(sampleData, function (person) {
                expectedIndex[person.name()] = person;
            });

            sourceArray = ko.observableArray(sampleData);
            indexedData = sourceArray.uniqueIndexBy(function (person) {
                return person.name();
            })();
        });

        it("indexes the array according to the given function, returning a computed map", function () {
            expect(indexedData, 'to equal', expectedIndex);
        });

        it('updates the index on unshift', function () {
            sourceArray.unshift(queenVictoria, johnMKeynes);

            expectedIndex[queenVictoria.name()] = queenVictoria;
            expectedIndex[johnMKeynes.name()] = johnMKeynes;
            expect(indexedData, 'to equal', expectedIndex);
        });

        it('updates the index on push', function () {
            sourceArray.push(queenVictoria, johnMKeynes);

            expectedIndex[queenVictoria.name()] = queenVictoria;
            expectedIndex[johnMKeynes.name()] = johnMKeynes;
            expect(indexedData, 'to equal', expectedIndex);
        });

        it('updates the index on splice', function () {
            sourceArray.splice(3, 0, queenVictoria, johnMKeynes);

            expectedIndex[queenVictoria.name()] = queenVictoria;
            expectedIndex[johnMKeynes.name()] = johnMKeynes;
            expect(indexedData, 'to equal', expectedIndex);
        });

        it('updates the index on replacing with splice', function () {
            delete expectedIndex[sampleData[3].name()];
            delete expectedIndex[sampleData[4].name()];

            sourceArray.splice(3, 2, queenVictoria, johnMKeynes);

            expectedIndex[queenVictoria.name()] = queenVictoria;
            expectedIndex[johnMKeynes.name()] = johnMKeynes;
            expect(indexedData, 'to equal', expectedIndex);
        });

        it('updates the index on pop', function () {
            delete expectedIndex[sampleData[sampleData.length - 1].name()];
            sourceArray.pop();
            expect(indexedData, 'to equal', expectedIndex);
        });

        it('updates the index on shift', function () {
            delete expectedIndex[sampleData[0].name()];
            sourceArray.shift();
            expect(indexedData, 'to equal', expectedIndex);
        });

        it('does not change the index when the data is reversed', function () {
            sourceArray.reverse();
            expect(indexedData, 'to equal', expectedIndex);
        });

        it('does not change the index when the data is sort', function () {
            sourceArray.sort();
            expect(indexedData, 'to equal', expectedIndex);
        });

        it('updates the index when a sort key changes', function () {
            var nameBeforeChange = sampleData[3].name.peek();
            expectedIndex['Jesus Christ'] = sampleData[3];
            delete expectedIndex[nameBeforeChange];

            sampleData[3].name('Jesus Christ');

            expect(indexedData, 'to equal', expectedIndex);
        });

        it('throw an error if multiple items maps to the same key', function () {
            expect(function () {
                sourceArray.push(sampleData[0]);
            }, 'to throw', 'Unique indexes requires items must map to different keys; duplicate key: Marilyn Monroe');
        });

        describe('on multiple keys', function () {
            beforeEach(function () {
                indexedData = sourceArray.uniqueIndexBy(function (person) {
                    return [person.name(), person.yearOfBirth()];
                })();

                expectedIndex = {};
                ko.utils.arrayForEach(sampleData, function (person) {
                    expectedIndex[person.name()] = person;
                    expectedIndex[person.yearOfBirth()] = person;
                });
            });

            it("indexes the array according to the given function, returning a computed map", function () {
                expect(indexedData, 'to equal', expectedIndex);
            });
        });
    });

    it('supports a throttle option', function () {
        var underlyingArray = ko.observableArray([5, 6, 2, 5, 8, 3, 1, 2, 7, 7, 1, 0, 9, 3, 6, 4]);

        var prefix = ko.observable('number: ');
        var sortedArray = underlyingArray.indexBy({
            mapping: function (x) {
                return prefix() + x;
            },
            throttle: 200
        });
        var spy = sinon.spy();
        sortedArray.subscribe(spy);

        expect(sortedArray(), 'to equal', {
            'number: 5': [5, 5],
            'number: 6': [6, 6],
            'number: 2': [2, 2],
            'number: 8': [8],
            'number: 3': [3, 3],
            'number: 1': [1, 1],
            'number: 7': [7, 7],
            'number: 0': [0],
            'number: 9': [9],
            'number: 4': [4]
        });

        prefix('id: ');
        expect(spy, 'was not called');

        clock.tick(201);

        expect(spy, 'was called once');

        expect(sortedArray(), 'to equal', {
            'id: 5': [5, 5],
            'id: 6': [6, 6],
            'id: 2': [2, 2],
            'id: 8': [8],
            'id: 3': [3, 3],
            'id: 1': [1, 1],
            'id: 7': [7, 7],
            'id: 0': [0],
            'id: 9': [9],
            'id: 4': [4]
        });
    });
});
