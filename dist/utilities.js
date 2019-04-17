"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var faker = require("faker");
function chooseNull() {
    return faker.random.boolean();
}
exports.chooseNull = chooseNull;
function randomFromArray(array) {
    return array[faker.random.number({ min: 0, max: array.length - 1, precision: 1 })];
}
exports.randomFromArray = randomFromArray;
