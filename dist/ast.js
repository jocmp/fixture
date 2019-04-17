"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// apollo-codegen uses Object.entries and Array.flatmap
require("core-js/es/object");
require("core-js/es/array");
var legacyIR_1 = require("apollo-codegen-core/lib/compiler/legacyIR");
var OperationType;
(function (OperationType) {
    OperationType["Query"] = "query";
    OperationType["Mutation"] = "mutation";
    OperationType["Subscription"] = "subscription";
})(OperationType = exports.OperationType || (exports.OperationType = {}));
function isOperation(operationOrFragment) {
    return operationOrFragment.hasOwnProperty('operationName');
}
exports.isOperation = isOperation;
function isTypedVariable(variable) {
    return variable.type != null;
}
exports.isTypedVariable = isTypedVariable;
exports.compile = legacyIR_1.compileToLegacyIR;
