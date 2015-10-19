import {List,Map,Record} from 'immutable';

import {crc32,isObject} from './utils';
import querystring from 'querystring';

class Query extends Record({
  field: undefined,
  alias: undefined,
  args: List(),
  range: List(),
  children: List()
}) {
  responseKey() {
    return this.alias || this.field.name;
  }
  graphKey() {
    return this.field.name;
  }
};

class Argument extends Record({
  name: undefined,
  value: undefined
}) { }


var pop = (stack) => {
  return [stack.first(), stack.pop()];
}

var addReferenceId = (schema, field, children) => {
  if (schema.isReferenceable(field) && !children.some(child => child.name === 'id')) {
    var idField = schema.getField(field, 'id');

    return children.push(new Query({
      field: idField
    }))
  } else {
    return children;
  }
}

// var parseCollectionArgs = (schema, field, path) => {
//   // test if list and first 2 args are 'from' and 'to'
//   if (schema.isCollection(field)) {
//     var [value, rest] = pop(path);
//     var args = List()
//       .push(Map({name: 'to', value: value.to}))
//       .push(Map({name: 'from', value: value.from || 0}));
//
//     return {args, path: rest};
//   } else {
//     return {args: List(), path};
//   }
// }

// var parseArgs = (schema, field, path) => {
//   var collectionArgs = parseCollectionArgs(schema, field, path);
//
//   return nonCollectionArgs(schema, field).reduce(({args, path}, arg) => {
//     var [value, rest] = pop(path);
//     return {args: args.push(Map({name: arg, value})), path: rest};
//   }, collectionArgs);
// }

var parseRange = (schema, field, path) => {
  if (schema.isCollection(field)) {
    var [range, rest] = pop(path);
    var args = List();

    if (Array.isArray(range)) {
      args = args
        .push(new Argument({name: 'from', value: Math.min.apply(Math, range)}))
        .push(new Argument({name: 'to', value: Math.max.apply(Math, range)}));
    } else if (isObject(range)) {
      var from = range.from || 0;
      var to = range.to || (range.from + range.length - 1);
      args = args
        .push(new Argument({name: 'from', value: from}))
        .push(new Argument({name: 'to', value: to}));
    } else if (Number.isInteger(range)) {
      args = args
        .push(new Argument({name: 'from', value: range}))
        .push(new Argument({name: 'to', value: range}));
    } else {
      throw `unhandled type of range: ${range}`;
    }

    return {args, path: rest};
  } else {
    return {args: List(), path}
  }
}

var nonRangeArgs = (schema, field) => {
  if (schema.isCollection(field)) {
    return field.args.filterNot(arg => arg === 'to' || arg === 'from');
  } else {
    return field.args;
  }
}

var parseArgs = (schema, field, path) => {
  var args = nonRangeArgs(schema, field);
  if (args.isEmpty()) {
    return {args:List(), path}
  } else if (args.size === 1) {
    var [value, rest] = pop(path);
    return {
      args: List([new Argument({name: args.get(0), value: value})]),
      path: rest
    }
  } else {
    var [value, rest] = pop(path);
    var values = querystring.parse(value);
    return {
      args: args.reduce((args, arg) => {
        if (values[arg]) {
          return args.push(new Argument({name: arg, value: values[arg]}));
        } else {
          return args;
        }
      }, List()),
      path: rest
    };
    return {args: List([new Argument({name: args.get(0), value: value})])}
  }
  // return nonRangeArgs(schema, field).reduce(({args, path}, arg) => {
  //   var [value, rest] = pop(path);
  //   return {args: args.push(new Argument({name: arg, value})), path: rest};
  // }, {args: List(), path});
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

var fieldAlias = (field, args) => {
  if (!args.isEmpty()) {
    var slug = args.map(arg => `.${arg.get('name')}(${arg.get('value')})`).join('');
    return `${field.name}${Math.abs(crc32(slug)).toString(36)}`;
  }
}

var parseField = (schema, field, path) => {
  var args = parseArgs(schema, field, path);
  var range = parseRange(schema, field, args.path);
  var children = parseChildren(schema, field, range.path);

  return new Query({
    field: field,
    alias: fieldAlias(field, args.args),
    args: args.args,
    range: range.args,
    children: addReferenceId(schema, field, children)
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

var stringifyName = (field) => {
  if (field.alias) {
    return `${field.alias}:${field.field.name}`;
  } else {
    return field.field.name;
  }
}

var stringifyField = (field) => {
  return `${stringifyName(field)}${stringifyArgs(field.get('args'),field.get('range'))}${stringifyChildren(field.get('children'))}`;
}

var stringifyChildren = (children) => {
  if (children.isEmpty()) {
    return '';
  } else {
    var fieldStrings = children.map(stringifyField);
    return ` { ${fieldStrings.join(', ')} } `;
  }
}

var stringifyArgs = (args, range) => {
  var all = args.concat(range);
  if (all.isEmpty()) {
    return '';
  } else {
    var argStrings = all.map(arg => `${arg.get('name')}: ${arg.get('value')}`);
    return `(${argStrings.join(', ')})`;
  }
}

export function stringifyQuery (query) {
  var rootStrings = query.map(stringifyField);
  return `query { ${rootStrings.join(', ')} }`;
}
