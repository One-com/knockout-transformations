(function() {
    var ko = this.ko || require('../src/knockout-projections.js');

    function Person(name, yearOfBirth) {
        this.name = ko.observable(name);
        this.yearOfBirth = ko.observable(yearOfBirth);
    }

    Person.prototype.jasmineToString = function () {
        return this.inspect();
    };

    Person.prototype.inspect = function () {
        return this.yearOfBirth() + ' ' + this.name();
    };

    describe("IndexBy", function () {
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
                expect(indexedData()).toOnlyHaveKeys([]);
            });
        });

        describe('on simple data', function () {
            var sampleData, sourceArray, indexedData;

            beforeEach(function () {
                sampleData = ['Beta', 'Beta', 'Gamma', 'Alpha'];
                sourceArray = ko.observableArray(sampleData);
                indexedData = sourceArray.indexBy(function(item) { return item; })();
            });

            it("indexes the array according to the given function, returning a computed map", function () {
                expect(indexedData).toEqual({
                    'Alpha': ['Alpha'],
                    'Beta': ['Beta', 'Beta'],
                    'Gamma': ['Gamma']
                });
            });

            it('updates the index on unshift', function () {
                sourceArray.unshift('Foo', 'Bar');
                expect(indexedData).toEqual({
                    'Alpha': ['Alpha'],
                    'Beta': ['Beta', 'Beta'],
                    'Gamma': ['Gamma'],
                    'Foo': ['Foo'],
                    'Bar': ['Bar']
                });
            });

            it('updates the index on push', function () {
                sourceArray.push('Foo', 'Bar', 'Beta');
                expect(indexedData).toEqual({
                    'Alpha': ['Alpha'],
                    'Beta': ['Beta', 'Beta', 'Beta'],
                    'Gamma': ['Gamma'],
                    'Foo': ['Foo'],
                    'Bar': ['Bar']
                });
            });

            it('updates the index on splice', function () {
                sourceArray.splice(3, 0, 'Foo', 'Bar');
                expect(indexedData).toEqual({
                    'Alpha': ['Alpha'],
                    'Beta': ['Beta', 'Beta'],
                    'Gamma': ['Gamma'],
                    'Foo': ['Foo'],
                    'Bar': ['Bar']
                });
            });

            it('updates the index on replacing with splice', function () {
                sourceArray.splice(1, 2, 'Foo', 'Bar');
                expect(indexedData).toEqual({
                    'Alpha': ['Alpha'],
                    'Beta': ['Beta'],
                    'Foo': ['Foo'],
                    'Bar': ['Bar']
                });
            });

            it('updates the index on pop', function () {
                sourceArray.pop();
                expect(indexedData).toEqual({
                    'Beta': ['Beta', 'Beta'],
                    'Gamma': ['Gamma']
                });
            });

            it('updates the index on shift', function () {
                sourceArray.shift();
                expect(indexedData).toEqual({
                    'Alpha': ['Alpha'],
                    'Beta': ['Beta'],
                    'Gamma': ['Gamma'],
                });
            });

            it('does not change the index when the data is reversed', function () {
                sourceArray.reverse();
                expect(indexedData).toEqual({
                    'Alpha': ['Alpha'],
                    'Beta': ['Beta', 'Beta'],
                    'Gamma': ['Gamma'],
                });
            });

            it('does not change the index when the data is sort', function () {
                sourceArray.sort();
                expect(indexedData).toEqual({
                    'Alpha': ['Alpha'],
                    'Beta': ['Beta', 'Beta'],
                    'Gamma': ['Gamma'],
                });
            });
        });

        describe('on complex data', function () {
            var sampleData, sourceArray, indexedData, expectedIndex;
            var queenVictoria, johnMKeynes;

            beforeEach(function () {
                var env = jasmine.getEnv();
                env.addEqualityTester(function (a, b) {
                    if (!(a instanceof Person && b instanceof Person)) {
                        return jasmine.undefined;
                    }

                    return a.name() === b.name() && a.yearOfBirth() === a.yearOfBirth();
                });

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
                indexedData = sourceArray.indexBy(function(person) {
                    return person.name();
                })();
            });

            it("indexes the array according to the given function, returning a computed map", function () {
                expect(indexedData).toEqual(expectedIndex);
            });

            it('updates the index on unshift', function () {
                sourceArray.unshift(queenVictoria, johnMKeynes);

                expectedIndex[queenVictoria.name()] = [queenVictoria];
                expectedIndex[johnMKeynes.name()] = [johnMKeynes];
                expect(indexedData).toEqual(expectedIndex);
            });

            it('updates the index on push', function () {
                sourceArray.push(queenVictoria, johnMKeynes);

                expectedIndex[queenVictoria.name()] = [queenVictoria];
                expectedIndex[johnMKeynes.name()] = [johnMKeynes];
                expect(indexedData).toEqual(expectedIndex);
            });

            it('updates the index on splice', function () {
                sourceArray.splice(3, 0, queenVictoria, johnMKeynes);

                expectedIndex[queenVictoria.name()] = [queenVictoria];
                expectedIndex[johnMKeynes.name()] = [johnMKeynes];
                expect(indexedData).toEqual(expectedIndex);
            });

            it('updates the index on replacing with splice', function () {
                delete expectedIndex[sampleData[3].name()];
                delete expectedIndex[sampleData[4].name()];

                sourceArray.splice(3, 2, queenVictoria, johnMKeynes);

                expectedIndex[queenVictoria.name()];
                expectedIndex[queenVictoria.name()] = [queenVictoria];
                expectedIndex[johnMKeynes.name()] = [johnMKeynes];
                expect(indexedData).toEqual(expectedIndex);
            });

            it('updates the index on pop', function () {
                delete expectedIndex[sampleData[sampleData.length - 1].name()];
                sourceArray.pop();
                expect(indexedData).toEqual(expectedIndex);
            });

            it('updates the index on shift', function () {
                delete expectedIndex[sampleData[0].name()];
                sourceArray.shift();
                expect(indexedData).toEqual(expectedIndex);
            });

            it('does not change the index when the data is reversed', function () {
                sourceArray.reverse();
                expect(indexedData).toEqual(expectedIndex);
            });

            it('does not change the index when the data is sort', function () {
                sourceArray.sort();
                expect(indexedData).toEqual(expectedIndex);
            });

            it('updates the index when a sort key changes', function () {
                var nameBeforeChange = sampleData[3].name.peek();
                expectedIndex['Jesus Christ'] = [sampleData[3]];
                delete expectedIndex[nameBeforeChange];

                sampleData[3].name('Jesus Christ');

                expect(indexedData).toEqual(expectedIndex);
            });
        });
    });

    describe("UniqueIndexBy", function () {
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
                expect(indexedData).toOnlyHaveKeys([]);
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
                expect(indexedData).toEqual({
                    'Alpha': 'Alpha',
                    'Beta': 'Beta',
                    'Gamma': 'Gamma'
                });
            });

            it('updates the index on unshift', function () {
                sourceArray.unshift('Foo', 'Bar');
                expect(indexedData).toEqual({
                    'Alpha': 'Alpha',
                    'Beta': 'Beta',
                    'Gamma': 'Gamma',
                    'Foo': 'Foo',
                    'Bar': 'Bar'
                });
            });

            it('updates the index on push', function () {
                sourceArray.push('Foo', 'Bar');
                expect(indexedData).toEqual({
                    'Alpha': 'Alpha',
                    'Beta': 'Beta',
                    'Gamma': 'Gamma',
                    'Foo': 'Foo',
                    'Bar': 'Bar'
                });
            });

            it('updates the index on splice', function () {
                sourceArray.splice(3, 0, 'Foo', 'Bar');
                expect(indexedData).toEqual({
                    'Alpha': 'Alpha',
                    'Beta': 'Beta',
                    'Gamma': 'Gamma',
                    'Foo': 'Foo',
                    'Bar': 'Bar'
                });
            });

            it('updates the index on replacing with splice', function () {
                sourceArray.splice(1, 2, 'Foo', 'Bar');
                expect(indexedData).toEqual({
                    'Beta': 'Beta',
                    'Foo': 'Foo',
                    'Bar': 'Bar'
                });
            });

            it('updates the index on pop', function () {
                sourceArray.pop();
                expect(indexedData).toEqual({
                    'Beta': 'Beta',
                    'Gamma': 'Gamma'
                });
            });

            it('updates the index on shift', function () {
                sourceArray.shift();
                expect(indexedData).toEqual({
                    'Alpha': 'Alpha',
                    'Gamma': 'Gamma',
                });
            });

            it('does not change the index when the data is reversed', function () {
                sourceArray.reverse();
                expect(indexedData).toEqual({
                    'Alpha': 'Alpha',
                    'Beta': 'Beta',
                    'Gamma': 'Gamma',
                });
            });

            it('does not change the index when the data is sort', function () {
                sourceArray.sort();
                expect(indexedData).toEqual({
                    'Alpha': 'Alpha',
                    'Beta': 'Beta',
                    'Gamma': 'Gamma',
                });
            });

            it('throw an error if multiple items maps to the same key', function () {
                expect(function () {
                    sourceArray.push('Beta');
                }, 'to throw', 'Unique indexes requires items must map to different keys');
            });
        });

        describe('on complex data', function () {
            var sampleData, sourceArray, indexedData, expectedIndex;
            var queenVictoria, johnMKeynes;

            beforeEach(function () {
                var env = jasmine.getEnv();
                env.addEqualityTester(function (a, b) {
                    if (!(a instanceof Person && b instanceof Person)) {
                        return jasmine.undefined;
                    }

                    return a.name() === b.name() && a.yearOfBirth() === a.yearOfBirth();
                });

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
                    new Person("Queen Elizabeth II", 1926)
                ];

                expectedIndex = {};
                ko.utils.arrayForEach(sampleData, function (person) {
                    if (!expectedIndex[person.name()]) {
                        expectedIndex[person.name()] = person;
                    }
                });

                sourceArray = ko.observableArray(sampleData);
                indexedData = sourceArray.uniqueIndexBy(function(person) {
                    return person.name();
                })();
            });

            it("indexes the array according to the given function, returning a computed map", function () {
                expect(indexedData).toEqual(expectedIndex);
            });

            it('updates the index on unshift', function () {
                sourceArray.unshift(queenVictoria, johnMKeynes);

                expectedIndex[queenVictoria.name()] = queenVictoria;
                expectedIndex[johnMKeynes.name()] = johnMKeynes;
                expect(indexedData).toEqual(expectedIndex);
            });

            it('updates the index on push', function () {
                sourceArray.push(queenVictoria, johnMKeynes);

                expectedIndex[queenVictoria.name()] = queenVictoria;
                expectedIndex[johnMKeynes.name()] = johnMKeynes;
                expect(indexedData).toEqual(expectedIndex);
            });

            it('updates the index on splice', function () {
                sourceArray.splice(3, 0, queenVictoria, johnMKeynes);

                expectedIndex[queenVictoria.name()] = queenVictoria;
                expectedIndex[johnMKeynes.name()] = johnMKeynes;
                expect(indexedData).toEqual(expectedIndex);
            });

            it('updates the index on replacing with splice', function () {
                delete expectedIndex[sampleData[3].name()];
                delete expectedIndex[sampleData[4].name()];

                sourceArray.splice(3, 2, queenVictoria, johnMKeynes);

                expectedIndex[queenVictoria.name()];
                expectedIndex[queenVictoria.name()] = queenVictoria;
                expectedIndex[johnMKeynes.name()] = johnMKeynes;
                expect(indexedData).toEqual(expectedIndex);
            });

            it('updates the index on pop', function () {
                delete expectedIndex[sampleData[sampleData.length - 1].name()];
                sourceArray.pop();
                expect(indexedData).toEqual(expectedIndex);
            });

            it('updates the index on shift', function () {
                delete expectedIndex[sampleData[0].name()];
                sourceArray.shift();
                expect(indexedData).toEqual(expectedIndex);
            });

            it('does not change the index when the data is reversed', function () {
                sourceArray.reverse();
                expect(indexedData).toEqual(expectedIndex);
            });

            it('does not change the index when the data is sort', function () {
                sourceArray.sort();
                expect(indexedData).toEqual(expectedIndex);
            });

            it('updates the index when a sort key changes', function () {
                var nameBeforeChange = sampleData[3].name.peek();
                expectedIndex['Jesus Christ'] = sampleData[3];
                delete expectedIndex[nameBeforeChange];

                sampleData[3].name('Jesus Christ');

                expect(indexedData).toEqual(expectedIndex);
            });

            it('throw an error if multiple items maps to the same key', function () {
                expect(function () {
                    sourceArray.push(sampleData[0]);
                }, 'to throw', 'Unique indexes requires items must map to different keys');
            });
        });
    });
}());