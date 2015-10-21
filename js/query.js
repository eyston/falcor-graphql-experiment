import {List,Map,Record} from 'immutable';

import {crc32,isObject} from './utils';
import querystring from 'querystring';

export class Query extends Record({
  field: undefined,
  name: undefined, // maybe rename or something I dunno man
  alias: undefined,
  args: List(),
  range: List(),
  children: List(),

  graphKey: undefined,
  responseKey: undefined,

}) { }

var generateAlias = (name, args) => {
  if (args && !args.isEmpty()) {
    var slug = args.map(arg => `.${arg.name}(${arg.value})`).join('');
    return `${name}${Math.abs(crc32(slug)).toString(36)}`;
  }
}

var query = (field, attrs = Map()) => {
  var alias = generateAlias(field.name, attrs.get('args'));
  return new Query(Map({
    field: field,
    name: field.name,
    alias: alias,
    graphKey: field.name,
    responseKey: alias || field.name,
  }).merge(attrs));
}

export class Argument extends Record({
  name: undefined,
  value: undefined
}) { }

export class Range extends Record({
  to: undefined,
  from: undefined
}) { }

var pop = (stack) => {
  return [stack.first(), stack.pop()];
}

var toList = (itemOrArray) => {
  if (Array.isArray(itemOrArray)) {
    return List(itemOrArray);
  } else {
    return List.of(itemOrArray);
  }
}

var parseArgs = (field, path) => {
  if (field.args.isEmpty()) {
    return {args: List.of(List()), path};
  } else if (field.args.size === 1 && field.args.first().isRequired()) {
    var arg = field.args.first();
    var [value, rest] = pop(path);
    return {
      args: toList(value)
        .map(value => List.of(new Argument({name: arg.name, value: value}))),
      path: rest
    };
  } else {
    var [value, rest] = pop(path);
    // TODO: replace this with something that handles all types ...
    //       maybe copy GraphQL syntax instead of query string syntax
    return {
      args: toList(value)
        .map(value => {
          // TODO: validate that all named values exist yo
          // TODO: validate all required fields are provided ... mebe
          if (value === '__default__') {
            return List();
          } else {
            var values = querystring.parse(value);
            return field.args.reduce((args, arg) => {
              var name = arg.name;
              if (values[name]) {
                return args.push(new Argument({name, value: values[name]}));
              } else {
                return args;
              }
            }, List())
          }
        }),
      path: rest
    };
  }
}

var parseInnerType = (schema, field, path) => {
  return parseField(schema, field.updateIn(['type'], type => type.ofType), path);
}

var parseNonNull = parseInnerType;

var parseReference = (schema, field, path) => {
  return parseInnerType(schema, field, path)
    .updateIn(['children'], children => {
      if (children.find(child => child.name === 'id')) {
        return children;
      } else {
        var idField = schema.getField(field.type, 'id');
        return children.push(query(idField));
      }
    });
}

var normalizeRange = (range) => {
  if (Array.isArray(range)) {
    return new Range({
      from: Math.min.apply(Math, range),
      to: Math.max.apply(Math, range)
    });
  } else if (isObject(range)) {
    var from = range.from || 0;
    var to = range.to || (range.from + range.length - 1);
    return new Range({from, to});
  } else if (Number.isInteger(range)) {
    return new Range({
      from: range,
      to: range
    });
  } else {
    throw `unhandled type of range: ${range}`;
  }
}

var parseIndexCollectionRange = (field, path) => {
  var [range, rest] = pop(path);
  range = normalizeRange(range);

  return {
    range,
    path: rest
  };
}

var rangeToArguments = (range) => {
  return List.of(
    new Argument({name: 'from', value: range.from}),
    new Argument({name: 'to', value: range.to})
  );
}

var parseIndexCollection = (schema, field, path) => {
  var {range, path: rest} = parseIndexCollectionRange(field, path);

  return Map({
    range: rangeToArguments(range),
  }).merge(parseInnerType(schema, field, rest));
}

var parseScalar = (_, field, path) => {
  if (!path.isEmpty()) {
    throw `path should be empty after SCALAR kind but was ${path.toJS()}`
  }

  return Map();
}

var parseObject = (schema, field, path) => {
  var children = parseType(schema, field.type, path);

  return Map({
    children: children
  });
}

var parseField = (schema, field, path) => {
  // TODO: support 'LIST'
  // TODO: support 'CURSOR_COLLECTION'

  switch(field.type.kind) {
    case 'OBJECT':
      return parseObject(schema, field, path);
    case 'SCALAR':
      return parseScalar(schema, field, path);
    case 'NON_NULL':
      return parseNonNull(schema, field, path);
    case 'REFERENCE':
      return parseReference(schema, field, path);
    case 'INDEX_COLLECTION':
      return parseIndexCollection(schema, field, path);
    default:
      throw `Unhandled kind ${field.type.kind}`;
  }
}

var parseType = (schema, type, path) => {
  var [name, rest] = pop(path);

  return toList(name).flatMap(name => {
    var field = schema.getField(type, name);
    var args = parseArgs(field, rest);

    return args.args.map(arg => {
      return query(field, parseField(schema, field, args.path).set('args', arg));
    });
  });
}

export function parsePath (schema, path) {
  var type = schema.getQueryType();
  return parseType(schema, type, path);
}



var stringifyName = (query) => {
  if (query.alias) {
    return `${query.alias}:${query.field.name}`;
  } else {
    return query.field.name;
  }
}

var stringifyField = (query) => {
  return `${stringifyName(query)}${stringifyArgs(query)}${stringifyChildren(query.children)}`;
}

var stringifyChildren = (children) => {
  if (children.isEmpty()) {
    return '';
  } else {
    var fieldStrings = children.map(stringifyField);
    return ` { ${fieldStrings.join(', ')} } `;
  }
}

var stringifyArgValue = (query, arg) => {
  // hacky
  var fieldArg = query.field.args.find(farg => farg.name === arg.name);
  if (fieldArg && fieldArg.type.baseType().name === 'String') {
    return `"${arg.value}"`;
  } else {
    return `${arg.value}`;
  }
}

var stringifyArgs = (query) => {
  var args = query.args.concat(query.range);
  if (args.isEmpty()) {
    return '';
  } else {
    var argStrings = args.map(arg => `${arg.name}: ${stringifyArgValue(query, arg)}`);
    return `(${argStrings.join(', ')})`;
  }
}

export function stringifyQuery (query) {
  var rootStrings = query.map(stringifyField);
  return `query { ${rootStrings.join(', ')} }`;
}
