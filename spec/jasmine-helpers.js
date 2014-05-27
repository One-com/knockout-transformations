/*
------------------------------------------------------------------------------
Copyright (c) Microsoft Corporation
All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
THIS CODE IS PROVIDED *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE, MERCHANTABLITY OR NON-INFRINGEMENT.
See the Apache Version 2.0 License for specific language governing permissions and limitations under the License.
------------------------------------------------------------------------------
*/

(function() {
    var ko = this.ko || require('knockout');

    function getKeys(obj) {
        var keys = [];
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                keys.push(key);
            }
        }
        return keys;
    }

    // Add any spec helpers here
    jasmine.Matchers.prototype.toHaveKey = function(key) {
        return this.actual && this.actual.hasOwnProperty(expected);
    };

    jasmine.Matchers.prototype.toOnlyHaveKeys = function(keys) {
        if (!this.actual && keys.length > 0) {
            return false;
        }
        return this.env.equals_(getKeys(this.actual).sort(), keys.sort());
    };

    jasmine.Matchers.prototype.toOnlyContain = function(items) {
        if ((!this.actual && items.length > 0) ||
            (this.actual.length !== items.length)) {
            return false;
        }

        for (var i = 0; i < items.length; i += 1) {
            if (!this.env.contains_(this.actual, items[i])) {
                return false;
            }
        }

        return true;
    };
})();
