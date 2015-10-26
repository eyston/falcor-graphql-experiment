import {List,Range} from 'immutable';

import {mapFields} from '../schema';

import {
  Argument,
  parsePathSetRange,
  parsePathSetFieldInnerKind,
} from '../query';

import {parseQueryResponse} from '../graph';

const $atom = falcor.Model.atom;

const indexCollectionParser = {

  transformTypes(types) {
    return mapFields(types, transformIndexCollection);
  },

  pathSet(ctx, query, field, path) {
    const {range, path: rest} = parsePathSetRange(path);

    return parsePathSetFieldInnerKind(
      ctx,
      query.update('args', args => args.concat(rangeToArguments(range))),
      field,
      rest
    );

  },

  response(ctx, graph, path, query, response) {
    const startIndex = query.args.find(arg => arg.name === 'from').value;
    const endIndex = query.args.find(arg => arg.name === 'to').value;

    // meh
    const element = query
      .set('args', List())
      .updateIn(['field', 'type'], type => type.ofType)
      .setIn(['field', 'args'], List());

    return Range(startIndex, endIndex + 1).reduce((graph, collectionIndex, responseIndex) => {
      if (response[responseIndex]) {
        return parseQueryResponse(
          ctx,
          graph,
          path,
          element.set('name', collectionIndex),
          response[responseIndex]
        );
      } else {
        return graph.setIn(path.push(collectionIndex), $atom());
      }
    }, graph);
  }

}

export default indexCollectionParser;

const transformIndexCollection = field => {
  if (isIndexCollection(field)) {
    return field
      .set('range', List.of('to', 'from'))
      .update('type', type => type.changeKind('LIST', 'INDEX_COLLECTION'));
  } else {
    return field;
  }
}

const isIndexCollection = field => {
  // TODO: maybe add type checks that to / from are int?
  return field.type.containsKind('LIST')
    && field.args.find(arg => arg.name === 'to')
    && field.args.find(arg => arg.name === 'from');
}

const rangeToArguments = (range) => {
  return List.of(
    new Argument({name: 'from', value: range.from}),
    new Argument({name: 'to', value: range.to})
  );
}
