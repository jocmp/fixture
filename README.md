# `graphql-fixtures`

> Utilities for generating fixture objects from GraphQL documents.

## Installation

```
npm install amp-fixture --save-dev
```

or, with Yarn:

```
yarn add amp-fixture --dev
```

## Usage

### `createFiller(schema: GraphQLSchema, options?: Options): Filler`

Returns a function that will be used to create object fixtures. This function takes the GraphQL schema (which will be used to generate the correct type of data given the document), and an optional object with the following properties:

* `resolvers`: an object whose keys are names of types in the passed `schema`, and whose values are functions that return a fixture version of that type. This function can return a partial fixture; the default resolvers will then fill the remainder of the object. The function will be called two arguments: the GraphQL request (including variables), and details about the type and field currently being filled. You could use this to, for example, create dynamic values for a type based on the object in which it resides:

  ```ts
  let currentID = 1;
  const fill = createFiller(schema, {
    resolvers: {
      ID: (_, {parent}) => `gid://${parent.name}/${currentID++}`,
    },
  });
  ```

  If you return a fixture for an object type, the value of the fields you provide will be preferred over resolvers for the types of those fields.

  This library provides default fillers for all scalar types (including custom scalars, which will be filled as a random string value). It also will automatically select a random value from any `enum` type by default.

The function returned from `createFiller` has the following signature:

```ts
function fill<Data, Variables, PartialData>(
  // GraphQLOperation comes from graphql-typed, and is satisfied by
  // an import from a .graphql file and an asynchronous query component
  operation: GraphQLOperation<Data, Variables, PartialData>,
  data?: DeepThunk<PartialData>,
): (request: GraphQLRequest) => Data;
```

A document is generated by using the `gql` tagged template literal or by importing a `.graphql` file using [graphql-tag](https://github.com/apollographql/graphql-tag). To get automatic typing of the data that is expected for a document, use `.graphql` files and [`graphql-typescript-definitions`](../graphql-typescript-definitions).

The second argument is an optional `data` object. This object is how you can fill some set of fields each time you generate a fixture. You will usually want to use this in order to generate a fixture that has some subset of the query in a particular state, while the rest is randomly generated. The data provided here must match the shape of the data the GraphQL operation will provide, but every field and subfield is optional, and every field can either be a literal value or a function that returns a literal value. If using a function, the function will be called with the current GraphQL request (including the variables) and details about the type being filled as noted in the `resolvers` section above.

The return result from `fill` is itself a function. When this function is invoked with a `GraphQLRequest`, it will construct the actual return value. While it may seem counter-intuitive that the function does not return an object, returning a function instead has several benefits. It means that you can pass in an asynchronous GraphQL component as the first argument to `fill`, which provides the types for the data but does not actually provide the raw query object until later. It also means that any intermediate processing that is done by your GraphQL pipeline (such as adding a `__typename` property) are done before any attempt to fill the operation is complete.

If you need to have the filled object immediately, you can invoke `fill` as follows:

```ts
const data = fill(myQuery, data)({query: myQuery});
```

#### Interfaces and Unions

When attempting to fill data for a union or interface type, the filler will default to selecting a random type that implements the interface/ is a member of the union. If you would like to ensure a particular type is selected, but leave all the other fields to be filled by resolvers, you can provide a `__typename` field in the `data` argument for that field that selects the type you wish to be filled.

#### Example

Assuming the following schema:

```graphql
type Person {
  name: String!
}

type Query {
  self: Person!
}
```

With the following query:

```graphql
query MyQuery {
  self {
    __typename
    name
  }
}
```

We can create a simpler filler globally, and use it every time we wish to generate a fixture:

```ts
import {createFiller} from 'graphql-fixtures';
import schema from './schema';
import myQuery from './MyQuery.graphql';

const fill = createFiller(schema);

// will result in {self: {__typename: 'Person', name: <String>}}
const fillMyQueryOne = fill(myQuery);

// will result in {self: {__typename: 'Person', name: 'Chris'}}
const fillMyQueryTwo = fill(myQuery, {self: {name: 'Chris'}});
const fillMyQueryThree = fill(myQuery, {self: () => ({name: 'Chris'})});
```

As noted above, individual fields can be a function that takes the current GraphQL request and details about the field, and returns the partial data. You can even do this for the entire partial object, allowing you to completely switch out what partial data is used for an invocation based on things like the variables to the current query:

```ts
import {createFiller} from 'graphql-fixtures';
import schema from './schema';
import myQuery from './MyQuery.graphql';

const fill = createFiller(schema);

// Everything this library does is type-safe based on the original query.
// If there are required variables to the query, they will appear as required
// properties on the variables object for the request. No useless null checking!
const fillMyQuery = fill(myQuery, ({variables: {first}}) => {
  return {products: list(first)};
});
```

### `list<T>(size: number | [number, number], fill?: T): T[]`

Generates a list of the specified size for use in creating partially-filled data to a `fill` function as described above. The optional second argument is the value that will be used in each entry of the array, and so can be either a literal type the matches the list type you are filling, or a function that returns such a literal.

When a single number is provided as the first argument, an array of that size will be created. When an array with two numbers is provided, an array randomly sized in that range (inclusively) will be created.

```ts
// assuming `widgets` in a list of Widget objects

const fixture = fill(widgetQuery, {
  widgets: list([2, 4], {id: () => faker.random.uuid()}),
});
```
