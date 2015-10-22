import {List,Map,Record} from 'immutable';

import {crc32,isObject} from './utils';
import querystring from 'querystring';

export class Query extends Record({
  field: undefined,
  name: undefined, // maybe rename or something I dunno man
  args: List(),
  // range: List(),
  children: List(),

  // alias: undefined,

  graphKey: undefined, // just use name dummy
  // responseKey: undefined,

}) {

  alias() {
    // would be cool to memoize this but I dunno how in immutable record!
    if (!this.args.isEmpty()) {
      var slug = this.args.map(arg => `.${arg.name}(${arg.value})`).join('');
      return `${this.name}${Math.abs(crc32(slug)).toString(36)}`;
    }
  }

  responseKey() {
    // would be cool to memoize this too lulz
    return this.alias() || this.name;
  }

  static build(field, attrs = Map()) {
    // var alias = generateAlias(field.name, attrs.get('args'));
    return new Query(Map({
      field: field,
      name: field.name,
      // alias: alias,
      graphKey: field.name,
      // responseKey: alias || field.name,
    }).merge(attrs));
  }
}

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

var parseInnerType = (schema, query, field, path) => {
  return parseField(schema, query, field.updateIn(['type'], type => type.ofType), path);
}

var parseNonNull = parseInnerType;

var parseList = parseInnerType;

var parseReference = (schema, query, field, path) => {
  return parseInnerType(schema, query, field, path)
    .updateIn(['children'], children => {
      if (children.find(child => child.name === 'id')) {
        return children;
      } else {
        var idField = schema.getField(field.type, 'id');
        return children.push(Query.build(idField));
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

var parseIndexCollection = (schema, query, field, path) => {
  var {range, path: rest} = parseIndexCollectionRange(field, path);

  return parseInnerType(
    schema,
    query.update('args', args => args.concat(rangeToArguments(range))),
    field,
    rest
  );
}

var isRange = (pathSegment) => {
  return Number.isInteger(pathSegment)
    || (Array.isArray(pathSegment) && pathSegment.every(Number.isInteger))
    || isObject(pathSegment);
}

var parseIndexLengthCollection = (schema, query, field, path) => {

  if (isRange(path.first())) {
    var {range, path: rest} = parseIndexCollectionRange(field, path);

    var nodesField = schema.getField(field.type, 'nodes');
    // var nodesQuery = List.of(Query.build(nodesField, Map({children: parseType(schema, nodesField.type, rest)})));
    var nodesQuery = List.of(parseField(schema, Query.build(nodesField), nodesField, rest));

    return query
      .update('args', args => args.concat(rangeToArguments(range)))
      .set('children', nodesQuery);
  } else {
    return query.set('children', parseType(schema, field.type, path));
  }
}

var parseScalar = (schema, query, field, path) => {
  if (!path.isEmpty()) {
    throw `path should be empty after SCALAR kind but was ${path.toJS()}`
  }

  return query;
}

var parseObject = (schema, query, field, path) => {
  return query.set('children', parseType(schema, field.type, path));
}

var parseField = (schema, query, field, path) => {
  // TODO: support 'CURSOR_COLLECTION'

  switch(field.type.kind) {
    case 'OBJECT':
      return parseObject(schema, query, field, path);
    case 'SCALAR':
      return parseScalar(schema, query, field, path);
    case 'NON_NULL':
      return parseNonNull(schema, query, field, path);
    case 'REFERENCE':
      return parseReference(schema, query, field, path);
    case 'LIST':
      return parseList(schema, query, field, path);
    case 'INDEX_COLLECTION':
      return parseIndexCollection(schema, query, field, path);
    case 'INDEX_LENGTH_COLLECTION':
      return parseIndexLengthCollection(schema, query, field, path);
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
      var query = Query.build(field, Map({args: arg}));
      return parseField(schema, query, field, args.path);
    });
  });
}

export function parsePath (schema, path) {
  var type = schema.getQueryType();
  return parseType(schema, type, path);
}
