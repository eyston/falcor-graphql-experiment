import {List} from 'immutable';

import {
  objectParser,
  scalarParser,
  nonNullParser,
  referenceParser,
  indexCollectionParser,
  indexLengthCollectionParser,
  cursorCollectionParser,
} from './kinds';

import {slugFromArguments} from './arguments';

// OMG so many args ... :(
export function parseQueryResponse (ctx, graph, path, query, response) {

  const qp = path.concat(queryPath(query));

  if (!response) { // is it safe to always short circuit here?
    // should this be an atom or null?
    return graph.updateIn(qp, value => value || null);
  }

  return parseQueryResponseKind (ctx, graph, qp, query, response);

}

export function parseQueryResponseKind (ctx, graph, path, query, response) {
  switch(query.field.type.kind) {
    case 'OBJECT':
      return objectParser.response(ctx, graph, path, query, response);
    case 'SCALAR':
      return scalarParser.response(ctx, graph, path, query, response);
    case 'NON_NULL':
      return nonNullParser.response(ctx, graph, path, query, response);
    case 'REFERENCE':
      return referenceParser.response(ctx, graph, path, query, response);
    case 'INDEX_COLLECTION':
      return indexCollectionParser.response(ctx, graph, path, query, response);
    case 'INDEX_LENGTH_COLLECTION':
      return indexLengthCollectionParser.response(ctx, graph, path, query, response);
    case 'CURSOR_COLLECTION':
      return cursorCollectionParser.response(ctx, graph, path, query, response);
    default:
      throw `Unhandled kind ${query.field.type.kind}`;
  }
}

export function parseQueryInnerTypeResponse (ctx, graph, path, query, response) {
  return parseQueryResponseKind(ctx, graph, path, query.updateIn(['field', 'type'], type => type.ofType), response);
}

export function queryPath (query) {
  const field = query.field;
  const fieldBasicArgs = field.basicArgs();

  if (fieldBasicArgs.isEmpty()) {
    return List.of(query.name);
  } else if (fieldBasicArgs.size === 1 && fieldBasicArgs.first().isRequired()) {
    return List.of(query.name, query.args.first().value);
  } else {
    // TODO: move this to Query record
    const queryBasicArgs = query.args.filter(qarg => field.basicArgs().find(farg => farg.name === qarg.name));
    return List.of(query.name, slugFromArguments(queryBasicArgs));
  }

}
