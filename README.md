knockout-transformations
============

Live transform methods for Knockout observable arrays.

This plugin adds observable `map`, `filter`, `indexBy` and `sortBy` features to observable arrays, so you can transform collections in arbitrary ways and have the results automatically update whenever the underlying source data changes.

The project initialy started out as a fork of https://github.com/SteveSanderson/knockout-projections and therefore owes a lot to this project. This project is licensed under Apache 2.0 by Microsoft Corporation and the part of the code derived from this project is constrained by this license. The rest of the code is also licensed under Apache 2.0 by One.com.

Installation
============

Download a copy of `knockout-transformations.js` from [the `dist` directory](https://github.com/One-com/knockout-transformations/tree/master/dist) and reference it in your web application:

```html
<!-- First reference KO itself -->
<script src='knockout-x.y.z.js'></script>
<!-- Then reference knockout-transformations from dist -->
<script src='knockout-transformations.js'></script>
```

Be sure to reference it *after* you reference Knockout itself.

If you are using NPM you can install knockout and knockout-transformations the following way:

    npm install knockout knockout-transformations

Then just reference the distribution files from `node_modules`.

Using require.js you can either point to the index file in `lib` or
use the individual transformations from located in `lib`.

Usage
=====

**Mapping**

More info to follow. For now, here's a simple example:

```js
var sourceItems = ko.observableArray([1, 2, 3, 4, 5]);
```

There's a plain observable array. Now let's say we want to keep track of the squares of these values:

```js
var squares = sourceItems.map(function(x) { return x*x; });
```

Now `squares` is an observable array containing `[1, 4, 9, 16, 25]`. Let's modify the source data:

```js
sourceItems.push(6);
// 'squares' has automatically updated and now contains [1, 4, 9, 16, 25, 36]
```

This works with any transformation of the source data, e.g.:

```js
sourceItems.reverse();
// 'squares' now contains [36, 25, 16, 9, 4, 1]
```

The key point of this library is that these transformations are done *efficiently*. Specifically, your callback
function that performs the mapping is only called when strictly necessary (usually, that's only for newly-added
items). When you add new items to the source data, we *don't* need to re-map the existing ones. When you reorder
the source data, the output order is correspondingly changed *without* remapping anything.

This efficiency might not matter much if you're just squaring numbers, but when you are mapping complex nested
graphs of custom objects, it can be important to perform each mapping update with the minumum of work.

**Filtering**

As well as `map`, this plugin also provides `filter`:

```js
var evenSquares = squares.filter(function(x) { return x % 2 === 0; });
// evenSquares is now an observable containing [36, 16, 4]

sourceItems.push(9);
// This has no effect on evenSquares, because 9*9=81 is odd

sourceItems.push(10);
// evenSquares now contains [36, 16, 4, 100]
```

Again, your `filter` callbacks are only called when strictly necessary. Re-ordering or deleting source items don't
require any refiltering - the output is simply updated to match. Only newly-added source items must be subjected
to your `filter` callback.

**Sorting**

As well as `map` and `filter`, this plugin also provides `sortBy`:

```js
var sortedEvenSquares.sortBy(function (evenSquare, descending) {
    return descending(evenSquare);
});
// sortedEvenSquares now contains [100, 36, 16, 4]
```

A more involved example:

```js
function Person(name, yearOfBirth) {
    this.name = ko.observable(name);
    this.yearOfBirth = ko.observable(yearOfBirth);
}

var persons = ko.observableArray([
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
    new Person("Queen Elizabeth II", 1926)
]);

// Persons sorted by name
var sortedByName = persons.sortBy(function (person) {
    return person.name();
});

// sortedByName now contains
// [
//     new Person("Abraham Lincoln", 1809),
//     new Person("Bill Gates", 1955),
//     new Person("John F. Kennedy", 1917),
//     new Person("Mahatma Gandhi", 1869),
//     new Person("Marilyn Monroe", 1926),
//     new Person("Martin Luther King", 1929),
//     new Person("Mother Teresa", 1910),
//     new Person("Muhammad Ali", 1942)
//     new Person("Nelson Mandela", 1918),
//     new Person("Queen Elizabeth II", 1926),
//     new Person("Winston Churchill", 1874),
// ]

// Persons sorted by year of birth descending and then by name
var sortedByYearOfBirthAndThenName = persons.sortBy(function (person, descending) {
    return [descending(person.yearOfBirth()), person.name()];
});

// sortedByYearOfBirthAndThenName now contains
// [
//     new Person("Abraham Lincoln", 1809),
//     new Person("Mahatma Gandhi", 1869),
//     new Person("Winston Churchill", 1874),
//     new Person("Mother Teresa", 1910),
//     new Person("John F. Kennedy", 1917),
//     new Person("Nelson Mandela", 1918),
//     new Person("Martin Luther King", 1929),
//     new Person("Bill Gates", 1955),
//     new Person("Marilyn Monroe", 1926),
//     new Person("Queen Elizabeth II", 1926),
//     new Person("Muhammad Ali", 1942)
// ]
```

The sorted list is only updated when items are added or removed and when properties that are sorted on changes.

**Indexing**

This transformation provides you with live updated index on a key returned
by the given function. In contrast to the `map`, `filter` and `sortBy`
this transformation returns an object and is therefore not a candidate for
chaining.

```js
var squareIndex = squares.indexBy(function (square) {
    return square % 2 === 0 ? 'even' : 'odd';
});

// squareIndex now contains
// { even: [36, 16, 4], odd: [25, 9, 1] }
36, 25, 16, 9, 4, 1
```

A more involved example using the persons defined in the sorting example:

```js

// Persons indexed by year of birth
var personsIndexedByYearBirth = persons.indexBy(function (person) {
    return person.yearOfBirth();
});

// personsIndexedByYearBirth now contains
// {
//     1809: [new Person("Abraham Lincoln", 1809)],
//     1869: [new Person("Mahatma Gandhi", 1869)],
//     1874: [new Person("Winston Churchill", 1874)],
//     1910: [new Person("Mother Teresa", 1910)],
//     1917: [new Person("John F. Kennedy", 1917)],
//     1918: [new Person("Nelson Mandela", 1918)],
//     1929: [new Person("Martin Luther King", 1929)],
//     1955: [new Person("Bill Gates", 1955)],
//     1926: [new Person("Marilyn Monroe", 1926),
//            new Person("Queen Elizabeth II", 1926)],
//     1942: [new Person("Muhammad Ali", 1942)]
// }

// Persons indexed uniquely by name.
// Notice unique indexes requires items to map to distint keys;
// otherwise an exception is thrown.
var personsIndexedByName = persons.uniqueIndexBy(function (person) {
    return person.name();
});

// personsIndexedByName now contains
// {
//     "Abraham Lincoln": new Person("Abraham Lincoln", 1809),
//     "Mahatma Gandhi": new Person("Mahatma Gandhi", 1869),
//     "Winston Churchill": new Person("Winston Churchill", 1874),
//     "Mother Teresa": new Person("Mother Teresa", 1910),
//     "John F. Kennedy": new Person("John F. Kennedy", 1917),
//     "Nelson Mandela": new Person("Nelson Mandela", 1918),
//     "Martin Luther King": new Person("Martin Luther King", 1929),
//     "Bill Gates": new Person("Bill Gates", 1955),
//     "Marilyn Monroe": new Person("Marilyn Monroe", 1926),
//     "Queen Elizabeth II": new Person("Queen Elizabeth II", 1926),
//     "Muhammad Ali": new Person("Muhammad Ali", 1942)
// }
```

It is also possible to create an index on multiple keys to following way:

```js
var texts = ko.observableArray(['foo', 'bar', 'baz', 'qux', 'quux']);
// Index texts by
var indexedTexts = texts.indexBy(function (text) {
    var firstLetter = text[0];
    var lastLetter = text[text.length - 1];
    return [firstLetter, lastLetter];
});

// indexedTexts now contains
// {
//     f: ['foo'],
//     b: ['bar', 'baz'],
//     q: ['qux', 'quux'],
//     o: ['foo'],
//     r: ['bar'],
//     z: ['baz'],
//     x: ['qux', 'quux']
// }
```

**Chaining**

The above code also demonstrates that you can chain together successive `map`, `filter` and `sortBy` transformations.

When the underlying data changes, the effects will ripple out through the chain of computed arrays with the
minimum necessary invocation of your `map`, `filter` and `sortBy` callbacks.

How to build from source
========================

First, install [NPM](https://npmjs.org/) if you don't already have it. It comes with Node.js.

Second, install Grunt globally, if you don't already have it:

    npm install -g grunt-cli

Third, use NPM to download all the dependencies for this module:

    cd wherever_you_cloned_this_repo
    npm install

Now you can build the package (linting and running tests along the way):

    grunt

Or you can just run the linting tool and tests:

    grunt test

Or you can make Grunt watch for changes to the sources/specs and auto-rebuild after each change:

    grunt watch

The browser-ready output files will be dumped at the following locations:

 * `dist/knockout-transformations.js`
 * `dist/knockout-transformations.min.js`

License - Apache 2.0
====================

Copyright 2015 One.com

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
