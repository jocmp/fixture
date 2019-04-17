"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var faker = require("faker");
var graphql_1 = require("graphql");
var ast_1 = require("./ast");
var utilities_1 = require("./utilities");
var defaultResolvers = {
    String: function () { return faker.random.word(); },
    Int: function () { return faker.random.number({ precision: 1 }); },
    Float: function () { return faker.random.number({ precision: 0.01 }); },
    Boolean: function () { return faker.random.boolean(); },
    ID: function () { return faker.random.uuid(); },
};
function createFiller(schema, _a) {
    var _b = (_a === void 0 ? {} : _a).resolvers, customResolvers = _b === void 0 ? {} : _b;
    var documentToOperation = new Map();
    var resolvers = new Map(Object.entries(tslib_1.__assign({}, defaultResolvers, customResolvers)));
    var context = { schema: schema, resolvers: resolvers };
    return function fill(_document, data) {
        return function (request) {
            var operationName = request.operationName, query = request.query;
            var operation = (operationName && documentToOperation.get(operationName)) ||
                Object.values(ast_1.compile(schema, normalizeDocument(query)).operations)[0];
            if (operationName != null) {
                documentToOperation.set(operationName, operation);
            }
            return fillObject(operation.rootType, operation.rootType, 
            // the root type is kind of weird, since there is no "field" that
            // would be used in a resolver. For simplicity in the common case
            // we just hack this type to make it conform.
            [operation], data, request, context);
        };
    };
}
exports.createFiller = createFiller;
// The documents that come from tools like Apollo do not have all
// the details that Apollo’s codegen utilities expect. In particular,
// they do not include the necessary `loc` information on the top-level
// definitions of the document. This code normalizes those issues by
// propagating the `loc` from the query to the definitions, which is
// usually totally fine since we stick to one operation per document.
function normalizeDocument(document) {
    return tslib_1.__assign({}, document, { definitions: document.definitions.map(function (definition) { return (tslib_1.__assign({}, definition, { loc: definition.loc || document.loc })); }) });
}
function fillObject(type, parent, parentFields, partial, request, context) {
    var normalizedParentFields = parentFields.slice();
    // We know there will always be at least one here, because the field for the object
    // itself is at the end.
    var ownField = normalizedParentFields.pop();
    var _a = ownField.fields, fields = _a === void 0 ? [] : _a;
    var resolver = context.resolvers.get(type.name);
    var resolverObject = resolver &&
        unwrapThunk(resolver, request, {
            type: type,
            parent: parent,
            field: ownField,
            parentFields: normalizedParentFields,
        });
    var partialObject = partial &&
        unwrapThunk(partial, request, {
            type: type,
            parent: parent,
            field: ownField,
            parentFields: normalizedParentFields,
        });
    if ((resolverObject === null && !partialObject) ||
        (partialObject === null && !resolverObject)) {
        return null;
    }
    return fields.reduce(function (filledObject, field) {
        var _a;
        var valueFromPartial = partialObject && partialObject[field.responseName];
        var valueFromResolver = resolverObject && resolverObject[field.responseName];
        var valueToUse = valueFromPartial === undefined ? valueFromResolver : valueFromPartial;
        return tslib_1.__assign({}, filledObject, (_a = {}, _a[field.responseName] = fillType(field.type, field, valueToUse &&
            unwrapThunk(valueToUse, request, {
                type: type,
                parent: parent,
                field: field,
                parentFields: normalizedParentFields,
            }), type, ownField.hasOwnProperty('operationType') ? [] : parentFields, request, context), _a));
    }, {});
}
function isResolver(value) {
    return typeof value === 'function';
}
function unwrapThunk(value, request, details) {
    var type = details.type;
    var unwrappedType = graphql_1.isNonNullType(type) ? type.ofType : type;
    return isResolver(value)
        ? value(request, tslib_1.__assign({}, details, { type: unwrappedType }))
        : value;
}
function keyPathElement(responseName, fieldIndex) {
    return fieldIndex == null ? responseName : responseName + "[" + fieldIndex + "]";
}
// we need to set a seedOffset when filling fields that are indexed leafs in the
// graph, for indexed objects in the graph their key path will use the parent
// field index instead.
function withRandom(keypath, func, seedOffset) {
    if (seedOffset === void 0) { seedOffset = 0; }
    faker.seed(seedFromKeypath(keypath.map(function (_a) {
        var fieldIndex = _a.fieldIndex, responseName = _a.responseName;
        return keyPathElement(responseName, fieldIndex);
    })) + seedOffset);
    var value = func();
    faker.seed(Math.random() * 10000);
    return value;
}
function createValue(partialValue, value, request, details) {
    return withRandom(details.parentFields, function () {
        if (partialValue === undefined) {
            return graphql_1.isNonNullType(details.type) || !utilities_1.chooseNull()
                ? unwrapThunk(value, request, details)
                : null;
        }
        else {
            return unwrapThunk(partialValue, request, details);
        }
    }, details.field.fieldIndex);
}
function fillForPrimitiveType(type, _a) {
    var resolvers = _a.resolvers;
    var resolver = resolvers.get(type.name);
    if (resolver) {
        return resolver;
    }
    else if (graphql_1.isEnumType(type)) {
        return function () { return randomEnumValue(type); };
    }
    else {
        return function () { return faker.random.word(); };
    }
}
function fillType(type, field, partial, parent, parentFields, request, context) {
    var unwrappedType = graphql_1.isNonNullType(type) ? type.ofType : type;
    if (field.fieldName === '__typename') {
        return parent.name;
    }
    else if (graphql_1.isEnumType(unwrappedType) || graphql_1.isScalarType(unwrappedType)) {
        return createValue(partial, fillForPrimitiveType(unwrappedType, context), request, {
            type: type,
            field: field,
            parent: parent,
            parentFields: parentFields,
        });
    }
    else if (graphql_1.isListType(unwrappedType)) {
        var array = createValue(partial, function () { return []; }, request, {
            type: type,
            parent: parent,
            field: field,
            parentFields: parentFields,
        });
        return Array.isArray(array)
            ? array.map(function (value, fieldIndex) {
                return fillType(unwrappedType.ofType, tslib_1.__assign({}, field, { fieldIndex: fieldIndex }), value, parent, parentFields, request, context);
            })
            : array;
    }
    else if (graphql_1.isAbstractType(unwrappedType)) {
        var possibleTypes = context.schema.getPossibleTypes(unwrappedType);
        var resolverObject = unwrapThunk(context.resolvers.get(unwrappedType.name) || {}, request, {
            type: type,
            parent: parent,
            field: field,
            parentFields: parentFields,
        });
        var partialObject = unwrapThunk(partial || {}, request, {
            type: type,
            parent: parent,
            field: field,
            parentFields: parentFields,
        });
        var valueFromPartial = partialObject && partialObject.__typename;
        var valueFromResolver = resolverObject && resolverObject.__typename;
        var typename_1 = unwrapThunk(valueFromPartial === undefined ? valueFromResolver : valueFromPartial, request, {
            type: type,
            parent: parent,
            field: field,
            parentFields: parentFields,
        });
        var resolvedType_1 = typename_1
            ? possibleTypes.find(function (_a) {
                var name = _a.name;
                return name === typename_1;
            })
            : withRandom(parentFields.concat([field]), function () {
                return utilities_1.randomFromArray(context.schema.getPossibleTypes(unwrappedType));
            });
        if (resolvedType_1 == null) {
            throw new Error("No type found for '" + unwrappedType.name + "'" + (typename_1
                ? " (provided type '" + typename_1 + "' does not exist or is not a possible type)"
                : ''));
        }
        var filler = function () {
            return fillObject(resolvedType_1, parent, parentFields.concat([
                tslib_1.__assign({ fieldName: field.fieldName, responseName: field.responseName, isConditional: field.isConditional }, ((field.inlineFragments &&
                    field.inlineFragments[resolvedType_1.name]) ||
                    field)),
            ]), partial, request, context);
        };
        return createValue(partial === undefined ? undefined : filler, filler, request, {
            type: type,
            parent: parent,
            field: field,
            parentFields: parentFields,
        });
    }
    else {
        var filler = function () {
            return fillObject(unwrappedType, parent, parentFields.concat([field]), partial, request, context);
        };
        return createValue(partial === undefined ? undefined : filler, filler, request, {
            type: type,
            parent: parent,
            field: field,
            parentFields: parentFields,
        });
    }
}
function randomEnumValue(enumType) {
    return utilities_1.randomFromArray(enumType.getValues()).value;
}
function seedFromKeypath(keypath) {
    return keypath.reduce(function (sum, key) { return sum + seedFromKey(key); }, 0);
}
function seedFromKey(key) {
    return key.split('').reduce(function (sum, character) { return sum + character.charCodeAt(0); }, 0);
}
function list(size, partial) {
    var finalSize = typeof size === 'number' ? size : size[Math.round(Math.random())];
    return Array(finalSize).fill(partial);
}
exports.list = list;
