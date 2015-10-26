import {List,Map,Record} from 'immutable';

import {getField} from './schema';
import {crc32,isObject,toList} from './utils';

import {
  objectParser,
  scalarParser,
  nonNullParser,
  listParser,
  referenceParser,
  indexCollectionParser,
  indexLengthCollectionParser,
  cursorCollectionParser,
} from './kinds';

export class Query extends Record({
  field: undefined,
  name: undefined, // maybe rename or something I dunno man
  args: List(),
  children: List()
}) {

  alias() {
    // would be cool to memoize this but I dunno how in immutable record!
    if (!this.args.isEmpty()) {
      const slug = this.args.map(arg => `.${arg.name}(${arg.value})`).join('');
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

  static normalize(range) {
    if (Array.isArray(range)) {
      return new Range({
        from: Math.min.apply(Math, range),
        to: Math.max.apply(Math, range)
      });
    } else if (isObject(range)) {
      const from = range.from || 0;
      const to = range.to || (range.from + range.length - 1);
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
}

// dunno how I feel about this ctx grab bag but lets try it out!
export function pathSetToQuery (ctx, path) {
  const {types, queryType} = ctx;

  return parsePathSetType(ctx, queryType, path);
}

export function pop (stack) {
  return [stack.first(), stack.pop()];
}

export function parsePathSetType (ctx, type, path) {
  const [name, rest] = pop(path);
  const {types} = ctx;

  return toList(name).flatMap(name => {
    const field = getField(types, type, name);
    const parsedArgs = parsePathSetFieldArguments(field, rest);

    return parsedArgs.args.map(args => {
      const query = Query.build(field, Map({args: args}));
      return parsePathSetField(ctx, query, field, parsedArgs.path);
    });
  });
}

export function parsePathSetField (ctx, query, field, path) {
  switch(field.type.kind) {
    case 'OBJECT':
      return objectParser.pathSet(ctx, query, field, path);
    case 'SCALAR':
      return scalarParser.pathSet(ctx, query, field, path);
    case 'NON_NULL':
      return nonNullParser.pathSet(ctx, query, field, path);
    case 'REFERENCE':
      return referenceParser.pathSet(ctx, query, field, path);
    case 'LIST':
      return listParser.pathSet(ctx, query, field, path);
    case 'INDEX_COLLECTION':
      return indexCollectionParser.pathSet(ctx, query, field, path);
    case 'INDEX_LENGTH_COLLECTION':
      return indexLengthCollectionParser.pathSet(ctx, query, field, path);
    case 'CURSOR_COLLECTION':
      return cursorCollectionParser.pathSet(ctx, query, field, path);
    default:
      throw `Unhandled kind ${field.type.kind}`;
  }
}

export function parsePathSetFieldInnerKind (ctx, query, field, path) {
  return parsePathSetField(ctx, query, field.update('type', type => type.ofType), path);
}

export function isRange (pathSegment) {
  return Number.isInteger(pathSegment)
    || (Array.isArray(pathSegment) && pathSegment.every(Number.isInteger))
    || isObject(pathSegment);
}

export function parsePathSetRange (path) {
  const [range, rest] = pop(path);

  return {
    range: Range.normalize(range),
    path: rest
  };
}

const parsePathSetFieldArguments = (field, path) => {
  const basicArgs = field.basicArgs();
  if (basicArgs.isEmpty()) {
    return {args: List.of(List()), path};
  } else if (basicArgs.size === 1 && basicArgs.first().isRequired()) {
    const arg = basicArgs.first();
    const [value, rest] = pop(path);
    return {
      args: toList(value)
        .map(value => List.of(new Argument({name: arg.name, value: value}))),
      path: rest
    };
  } else {
    const [value, rest] = pop(path);
    return {
      args: toList(value)
        .map(valueString => {
          // TODO: validate that all named values exist yo
          // TODO: validate all required fields are provided ... mebe
          // TODO: handle InputObject and List ... right now its just shallow
          const value = JSON.parse(valueString);

          return List(Object.keys(value)).map(name => {
            return new Argument({name, value: value[name]});
          });
        }),
      path: rest
    };
  }
}
