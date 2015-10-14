import {List,Map,Record} from 'immutable';

var Query = Record({
  type: undefined,
  name: undefined,
  field: undefined,
  args: List(),
  children: List()
});

var pop = (stack) => {
  return [stack.first(), stack.pop()];
}

var addReferenceId = (schema, field, children) => {
  if (schema.isReferenceable(field) && !children.some(child => child.name === 'id')) {
    var idField = schema.getField(field, 'id');

    return children.push(Query({
      type: idField.type,
      name: 'id',
      field: idField
    }))
  } else {
    return children;
  }
}

var nonCollectionArgs = (schema, field) => {
  if (schema.isCollection(field)) {
    return field.args.slice(2);
  } else {
    return field.args;
  }
}

var parseCollectionArgs = (schema, field, path) => {
  // test if list and first 2 args are 'from' and 'to'
  if (schema.isCollection(field)) {
    var [value, rest] = pop(path);
    var args = List()
      .push(Map({name: 'to', value: value.to}))
      .push(Map({name: 'from', value: value.from || 0}));

    return {args, path: rest};
  } else {
    return {args: List(), path};
  }
}

var parseArgs = (schema, field, path) => {
  var collectionArgs = parseCollectionArgs(schema, field, path);

  return nonCollectionArgs(schema, field).reduce(({args, path}, arg) => {
    var [value, rest] = pop(path);
    return {args: args.push(Map({name: arg, value})), path: rest};
  }, collectionArgs);
}

var parseChildren = (schema, parent, path) => {
  if (path.isEmpty()) {
    return List();
  } else {
    var [names, rest] = pop(path);
    if (Array.isArray(names)) {
      return List(names).map((name) => {
        return parseField(schema, schema.getField(parent, name), rest);
      });
    } else {
      return List([parseField(schema, schema.getField(parent, names), rest)]);
    }
  }
}

var parseField = (schema, field, path) => {
  var {args, path: rest} = parseArgs(schema, field, path);
  var children = parseChildren(schema, field, rest);
  return Query({
    type: field.type,
    field: field,
    name: field.name,
    args: args,
    children: addReferenceId(schema, field, children)  // parseChildren(schema, field, rest)
  });
}

var parseRoot = (schema, path) => {
  var [name, rest] = pop(path);
  var root = schema.getQueryType();
  return parseField(schema, schema.getField(root, name), rest);
}

export function parsePath (schema, path) {
  return parseRoot(schema, path);
}


var stringifyField = (field) => {
  return `${field.get('name')}${stringifyArgs(field.get('args'))}${stringifyChildren(field.get('children'))}`;
}

var stringifyChildren = (children) => {
  if (children.isEmpty()) {
    return '';
  } else {
    var fieldStrings = children.map(stringifyField);
    return ` { ${fieldStrings.join(', ')} } `;
  }
}

var stringifyArgs = (args) => {
  if (args.isEmpty()) {
    return '';
  } else {
    var argStrings = args.map(arg => `${arg.get('name')}: ${arg.get('value')}`);
    return `(${argStrings.join(', ')})`;
  }
}

var stringifyRoot = (root) => {
  return `${root.get('name')}${stringifyArgs(root.get('args'))}${stringifyChildren(root.get('children'))}`;
}

export function stringifyQuery (query) {
  var rootStrings = query.map(stringifyRoot);
  return `query { ${rootStrings.join(', ')} }`;
}
