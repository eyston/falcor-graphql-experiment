import {List,Map,Record} from 'immutable';

import {crc32,isObject} from './utils';

class Context extends Record({
  schema: undefined,
  path: undefined,
  cursors: undefined,
}) {
  prefixPath(fragment) {
    return this.path.take(this.path.size - fragment.size);
  }
}

export class Query extends Record({
  field: undefined,
  name: undefined, // maybe rename or something I dunno man
  args: List(),
  children: List()
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
    return new Query(Map({
      field: field,
      name: field.name,
    }).merge(attrs));
  }
}

export class Argument extends Record({
  name: undefined,
  value: undefined
}) { }

export class Range extends Record({
  to: undefined,
  from: undefined
}) {
  length() {
    return (this.to - this.from) + 1;
  }
}

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
  var basicArgs = field.basicArgs();
  if (basicArgs.isEmpty()) {
    return {args: List.of(List()), path};
  } else if (basicArgs.size === 1 && basicArgs.first().isRequired()) {
    var arg = basicArgs.first();
    var [value, rest] = pop(path);
    return {
      args: toList(value)
        .map(value => List.of(new Argument({name: arg.name, value: value}))),
      path: rest
    };
  } else {
    var [value, rest] = pop(path);
    return {
      args: toList(value)
        .map(valueString => {
          // TODO: validate that all named values exist yo
          // TODO: validate all required fields are provided ... mebe
          // TODO: handle InputObject and List ... right now its just shallow
          var value = JSON.parse(valueString);

          return List(Object.keys(value)).map(name => {
            return new Argument({name, value: value[name]});
          });
        }),
      path: rest
    };
  }
}

var parseInnerType = (ctx, query, field, path) => {
  return parseField(ctx, query, field.updateIn(['type'], type => type.ofType), path);
}

var parseNonNull = parseInnerType;

var parseList = parseInnerType;

var parseReference = (ctx, query, field, path) => {
  return parseInnerType(ctx, query, field, path)
    .updateIn(['children'], children => {
      if (children.find(child => child.name === 'id')) {
        return children;
      } else {
        var idField = ctx.schema.getField(field.type, 'id');
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

var parseIndexCollection = (ctx, query, field, path) => {
  var {range, path: rest} = parseIndexCollectionRange(field, path);

  return parseInnerType(
    ctx,
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

var parseIndexLengthCollection = (ctx, query, field, path) => {
  var {schema} = ctx;

  if (isRange(path.first())) {
    var {range, path: rest} = parseIndexCollectionRange(field, path);

    var nodesField = schema.getField(field.type, 'nodes');
    var nodesQuery = List.of(parseField(ctx, Query.build(nodesField), nodesField, rest));

    return query
      .update('args', args => args.concat(rangeToArguments(range)))
      .set('children', nodesQuery);
  } else {
    return query.set('children', parseType(ctx, field.type, path));
  }
}

var rangeToCursorArguments = (cursors, path, range) => {
  var cursor = cursors.getCursor(path, range.from);

  if (cursor) {
    return List.of(
      new Argument({name: 'first', value: (range.from - cursor.index - 1) + range.length() }),
      new Argument({name: 'after', value: cursor.value})
    );
  } else {
    return List.of(
      new Argument({name: 'first', value: range.to + 1 })
    );
  }

}

var parseCursorCollection = (ctx, query, field, path) => {
  var {schema} = ctx;
  if (isRange(path.first())) {
    var {range, path: rest} = parseIndexCollectionRange(field, path);

    var edgesField = schema.getField(field.type, 'edges');
    var nodeField = schema.getField(edgesField.type, 'node');
    var cursorField = schema.getField(edgesField.type, 'cursor');

    var edgesQuery = Query.build(edgesField, Map({children: List.of(
      parseField(ctx, Query.build(nodeField), nodeField, rest),
      Query.build(cursorField)
    )}));

    return query
      .update('args', args => args.concat(rangeToCursorArguments(ctx.cursors, ctx.prefixPath(path), range)))
      .set('children', List.of(edgesQuery));
  } else {
    return query.set('children', parseType(ctx, field.type, path));
  }
}

var parseScalar = (ctx, query, field, path) => {
  if (!path.isEmpty()) {
    throw `path should be empty after SCALAR kind but was ${path.toJS()}`
  }

  return query;
}

var parseObject = (ctx, query, field, path) => {
  return query.set('children', parseType(ctx, field.type, path));
}

var parseField = (ctx, query, field, path) => {
  switch(field.type.kind) {
    case 'OBJECT':
      return parseObject(ctx, query, field, path);
    case 'SCALAR':
      return parseScalar(ctx, query, field, path);
    case 'NON_NULL':
      return parseNonNull(ctx, query, field, path);
    case 'REFERENCE':
      return parseReference(ctx, query, field, path);
    case 'LIST':
      return parseList(ctx, query, field, path);
    case 'INDEX_COLLECTION':
      return parseIndexCollection(ctx, query, field, path);
    case 'INDEX_LENGTH_COLLECTION':
      return parseIndexLengthCollection(ctx, query, field, path);
    case 'CURSOR_COLLECTION':
      return parseCursorCollection(ctx, query, field, path);
    default:
      throw `Unhandled kind ${field.type.kind}`;
  }
}

var parseType = (ctx, type, path) => {
  var [name, rest] = pop(path);
  var {schema} = ctx;

  return toList(name).flatMap(name => {
    var field = schema.getField(type, name);
    var args = parseArgs(field, rest);

    return args.args.map(arg => {
      var query = Query.build(field, Map({args: arg}));
      return parseField(ctx, query, field, args.path);
    });
  });
}

export function parsePath (schema, path, opts) {
  var ctx = new Context({schema, path, ...opts});
  var type = schema.getQueryType();
  return parseType(ctx, type, path);
}
