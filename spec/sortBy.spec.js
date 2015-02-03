(function() {
    var ko = this.ko || require('../src/knockout-transformations.js');
    function sorted(arr, comparefn) {
        return [].concat(arr).sort(comparefn);
    }

    describe("SortBy", function () {
        describe('on an empty array', function () {
            var sampleData, sourceArray, sortedArray;
            beforeEach(function () {
                sampleData = [];
                sourceArray = ko.observableArray(sampleData);
                sortedArray = sourceArray.sortBy(function (item) {
                    return item;
                });
            });

            it('results in an empty array', function () {
                expect(sortedArray()).toEqual([]);
            });
        });

        describe('on simple data', function () {
            var sampleData, sourceArray, sortedArray;

            beforeEach(function () {
                sampleData = ['Beta', 'Beta', 'Gamma', 'Alpha'];
                sourceArray = ko.observableArray(sampleData);
                sortedArray = sourceArray.sortBy(function(item) { return item; });
            });

            it("sort the array according to the given function, returning a new observable array", function () {
                expect(sortedArray()).toEqual(sorted(sampleData));
            });

            it('maintains the sort order when data is unshifted to the source array', function () {
                sourceArray.unshift('Foo', 'Bar');
                expect(sortedArray()).toEqual(sorted(sampleData));
            });

            it('maintains the sort order when data is pushed to the source array', function () {
                sourceArray.push('Foo', 'Bar');
                expect(sortedArray()).toEqual(sorted(sampleData));
            });

            it('maintains the sort order when data is spliced into the source array', function () {
                sourceArray.splice(3, 0, 'Foo', 'Bar');
                expect(sortedArray()).toEqual(sorted(sampleData));
            });

            it('maintains the sort order when data is replaced in the source array', function () {
                sourceArray.splice(3, 2, 'Foo', 'Bar');
                expect(sortedArray()).toEqual(sorted(sampleData));
            });

            it('maintains the sort order when items are popped from the source array', function () {
                sourceArray.pop();
                expect(sortedArray()).toEqual(sorted(sampleData));
            });

            it('maintains the sort order when items are shifted from the source array', function () {
                sourceArray.shift();
                expect(sortedArray()).toEqual(sorted(sampleData));
            });

            it('maintains the sort order when the source array is reversed', function () {
                sourceArray.reverse();
                expect(sortedArray()).toEqual(sorted(sampleData));
            });

            it('maintains the sort order when the source array is sorted', function () {
                sourceArray.sort();
                expect(sortedArray()).toEqual(sorted(sampleData));
            });

            it("returns a readonly computed observable array", function() {
                expect(ko.isObservable(sortedArray)).toBe(true);
                expect(ko.isComputed(sortedArray)).toBe(true);
                expect(function() { sortedArray([1, 2, 3]); }).toThrow(
                    "Cannot write a value to a ko.computed unless you specify a 'write' option." +
                        " If you wish to read the current value, don't pass any parameters.");
            });

            it("supports an alternative 'options' object syntax", function () {
                var sortedArray = sourceArray.sortBy({
                    mapping: function(item) { return item; }
                });
                expect(sortedArray()).toEqual(sorted(sampleData));
            });

            it("issues notifications when the underlying data changes, updating the mapped result", function () {
                var log = [];
                sortedArray.subscribe(function(values) { log.push(values); });

                // Initial state is set without any notification
                expect(sortedArray()).toEqual(sorted(sampleData));
                expect(log.length).toBe(0);

                // Try adding an item
                sourceArray.push('Another');
                expect(log.length).toBe(1);
                expect(log[0]).toEqual(sorted(sampleData));

                // Try removing an item
                sourceArray.splice(1, 1);
                expect(log.length).toBe(2);
                expect(log[1]).toEqual(sorted(sampleData));

                // Try mutating in place
                sourceArray()[1] = 'Modified';
                sourceArray.valueHasMutated();
                expect(log.length).toBe(3);
                expect(log[2]).toEqual(sorted(sampleData));
            });

            it('ignores when items are moved in the underlying data', function () {
                var log = [];
                sortedArray.subscribe(function(values) { log.push(values); });

                // Moving items in the underlying array
                Array.prototype.push.apply(sampleData, sampleData.splice(1, 3));
                sourceArray.valueHasMutated();
                expect(log.length).toBe(0);
                expect(sortedArray()).toEqual(sorted(sampleData));
            });

            it("is possible to chain mappings", function() {
                function getLength(item) {
                    return item.length;
                }

                var mappedArray = sortedArray.map(getLength);

                expect(mappedArray()).toEqual(sorted(sampleData).map(getLength));
            });

        });

        describe('on complex data', function () {
            function comparefn(a, b) {
                if (a.yearOfBirth() > b.yearOfBirth()) {
                    return -1;
                } else if (a.yearOfBirth() < b.yearOfBirth()) {
                    return 1;
                }

                if (a.name() < b.name()) {
                    return -1;
                } else if (a.name() > b.name()) {
                    return 1;
                }

                return 0;
            }

            function Person(name, yearOfBirth) {
                var that = this;
                this.name = ko.observable(name);
                this.yearOfBirth = ko.observable(yearOfBirth);

                this.isBefore1900 = ko.pureComputed(function () {
                    return that.yearOfBirth() < 1900;
                });
            }

            Person.prototype.jasmineToString = function () {
                return this.inspect();
            };

            Person.prototype.inspect = function () {
                return this.yearOfBirth() + ' ' + this.name();
            };

            var sampleData, sourceArray, sortedArray;

            beforeEach(function () {
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

                sourceArray = ko.observableArray(sampleData);
                sortedArray = sourceArray.sortBy(function(person, descending) {
                    return [descending(person.yearOfBirth()), person.name()];
                });
            });

            it("sort the array according to the given function, returning a new observable array", function () {
                expect(sortedArray()).toEqual(sorted(sampleData, comparefn));
            });

            it('maintains the sort order when data is unshifted to the source array', function () {
                sourceArray.unshift(new Person("Queen Victoria", 1819), new Person("John M Keynes", 1883));
                expect(sortedArray()).toEqual(sorted(sampleData, comparefn));
            });

            it('maintains the sort order when data is pushed to the source array', function () {
                sourceArray.push(new Person("Queen Victoria", 1819), new Person("John M Keynes", 1883));
                expect(sortedArray()).toEqual(sorted(sampleData, comparefn));
            });

            it('maintains the sort order when data is spliced into the source array', function () {
                sourceArray.splice(3, 0, new Person("Queen Victoria", 1819), new Person("John M Keynes", 1883));
                expect(sortedArray()).toEqual(sorted(sampleData, comparefn));
            });

            it('maintains the sort order when data is replaced in the source array', function () {
                sourceArray.splice(3, 2, new Person("Queen Victoria", 1819), new Person("John M Keynes", 1883));
                expect(sortedArray()).toEqual(sorted(sampleData, comparefn));
            });

            it('maintains the sort order when items are popped from the source array', function () {
                sourceArray.pop();
                expect(sortedArray()).toEqual(sorted(sampleData, comparefn));
            });

            it('maintains the sort order when items are shifted from the source array', function () {
                sourceArray.shift();
                expect(sortedArray()).toEqual(sorted(sampleData, comparefn));
            });

            it('maintains the sort order when the source array is reversed', function () {
                sourceArray.reverse();
                expect(sortedArray()).toEqual(sorted(sampleData, comparefn));
            });

            it('maintains the sort order when the source array is sorted', function () {
                sourceArray.sort();
                expect(sortedArray()).toEqual(sorted(sampleData, comparefn));
            });

            it('maintains the sort order when the data that is sorted on changes', function () {
                sampleData[3].name('Jesus Christ');
                sampleData[3].yearOfBirth(0);
                expect(sortedArray()).toEqual(sorted(sampleData, comparefn));
                expect(sortedArray()[sortedArray().length - 1].name()).toEqual('Jesus Christ');
            });

            it('maintains the sort order when the sort direction flips', function () {
                var i = sampleData.length;
                sampleData.forEach(function (item) {
                    item.yearOfBirth(0 - item.yearOfBirth());
                });

                expect(sortedArray()).toEqual(sorted(sampleData, comparefn));
            });

            describe('when the sort direction can change', function () {
                var variableSortedArray, variablecomparefn, sortDirection;

                beforeEach(function () {
                    sortDirection = ko.observable(-1);

                    variablecomparefn = function (a, b) {
                        var sortDir = sortDirection();

                        if (a.yearOfBirth() > b.yearOfBirth()) {
                            return 1 * sortDir;
                        } else if (a.yearOfBirth() < b.yearOfBirth()) {
                            return -1 * sortDir;
                        }

                        if (a.name() < b.name()) {
                            return -1;
                        } else if (a.name() > b.name()) {
                            return 1;
                        }

                        return 0;
                    }

                    variableSortedArray = sourceArray.sortBy(function(person, descending) {
                        if (sortDirection() === 1) {
                            return [person.yearOfBirth(), person.name()];
                        } else {
                            return [descending(person.yearOfBirth()), person.name()];
                        }
                    });
                });

                it('initially has the right sort order', function () {
                    expect(variableSortedArray()).toEqual(sorted(sampleData, variablecomparefn));
                });

                it('maintains sort order when changing to ascending sort direction', function () {
                    sortDirection(1);

                    expect(variableSortedArray()).toEqual(sorted(sampleData, variablecomparefn));
                });
            });

            describe('when chained on top of a "map" and "filter" transformations', function () {
                var mappedArray,
                    mappedArrayIndex,
                    filteredArrayLeft, filteredArrayRight,
                    sortedArrayLeft, sortedArrayRight;

                beforeEach(function () {
                    function PersonView(person) {
                        this.person = person;
                    }

                    mappedArray = sourceArray.map(function (person) {
                        return new PersonView(person);
                    });

                    mappedArrayIndex = mappedArray.uniqueIndexBy(function (view) {
                        return view.person.yearOfBirth() + ' ' + view.person.name();
                    });

                    filteredArrayLeft = mappedArray.filter(function (view) {
                        return view.person.isBefore1900();
                    });

                    filteredArrayRight = mappedArray.filter(function (view) {
                        return !view.person.isBefore1900();
                    });

                    sortedArrayLeft = filteredArrayLeft.sortBy(function (view) {
                        return [view.person.yearOfBirth(), view.person.name()];
                    }).extend({rateLimit: 10});

                    sortedArrayRight = filteredArrayRight.sortBy(function (view) {
                        return [view.person.yearOfBirth(), view.person.name()];
                    }).extend({rateLimit: 10});
                });

                it('has the same amount of items in the filtered and sorted arrays', function () {
                    expect(filteredArrayLeft().length).toEqual(sortedArrayLeft().length);

                    expect(filteredArrayRight().length).toEqual(sortedArrayRight().length);
                });

                describe('when pushing a new item that first is in the left then in the right filtered array', function () {
                    var person, personView;
                    beforeEach(function () {
                        person = new Person("Queen Victoria", 1819);
                        sourceArray.push(person);

                        person.yearOfBirth(1919);

                        personView = mappedArrayIndex()[person.yearOfBirth() + ' ' + person.name()];
                    });

                    it('has the new item in the right sorted array only', function () {
                        expect(sortedArrayLeft().indexOf(personView)).toEqual(-1);
                        expect(sortedArrayRight().indexOf(personView)).toEqual(4);
                    });

                    it('has the same amount of items in the filtered and sorted arrays', function () {
                        expect(filteredArrayLeft().length).toEqual(sortedArrayLeft().length);

                        expect(filteredArrayRight().length).toEqual(sortedArrayRight().length);
                    });
                });
            });
        });

        it('supports a throttle option', function () {
            jasmine.Clock.useMock();
            var underlyingArray = ko.observableArray([ 0, 6, 5, 1, 3, 7, 2, 8, 9, 4 ]);

            var descending = ko.observable(false);
            var sortedArray = underlyingArray.sortBy({
                mapping: function (x, decending) {
                    return descending() ? decending(x) : x;
                },
                throttle: 200
            });
            var spy = jasmine.createSpy('subscription');
            sortedArray.subscribe(spy);

            expect(sortedArray()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
            descending(true);
            expect(spy.callCount).toEqual(0);

            jasmine.Clock.tick(201);

            expect(spy.callCount).toEqual(1);

            expect(sortedArray()).toEqual([ 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 ]);
        });
    });
}());
