import {List,Range} from 'immutable';

import {mapFields,getField} from '../schema';

import {
  Query,
  Argument,
  isRange,
  parsePathSetRange,
  parsePathSetType,
  parsePathSetField,
} from '../query';

import { parseQueryResponse } from '../graph';

const $atom = falcor.Model.atom;

const indexLengthCollectionParser = {

  transformTypes(types) {
    return mapFields(types, field =>
      transformIndexLengthCollection(types, field)
    );
  },

  pathSet(ctx, query, field, path) {
    const {types} = ctx;

    if (isRange(path.first())) {
      const {range, path: rest} = parsePathSetRange(path);

      const nodesField = getField(types, field.type, 'nodes');
      const nodesQuery = List.of(parsePathSetField(ctx, Query.build(nodesField), nodesField, rest));

      return query
        .update('args', args => args.concat(rangeToArguments(range)))
        .set('children', nodesQuery);
    } else {
      return query.set('children', parsePathSetType(ctx, field.type, path));
    }
  },

  response(ctx, graph, path, query, response) {
    return query.children.reduce((graph, child) => {
      if (child.name === 'nodes') {
        const startIndex = query.args.find(arg => arg.name === 'from').value;
        const endIndex = query.args.find(arg => arg.name === 'to').value;
        const nodes = response.nodes || [];

        // meh ...
        const element = child.updateIn(['field', 'type'], type => type.ofType);

        return Range(startIndex, endIndex + 1).reduce((graph, collectionIndex, responseIndex) => {
          if (nodes[responseIndex]) {
            return parseQueryResponse(ctx, graph, path, element.set('name', collectionIndex), nodes[responseIndex]);
          } else {
            return graph.setIn(path.push(collectionIndex), $atom());
          }
        }, graph);
      } else {
        return parseQueryResponse(ctx, graph, path, child, response[child.responseKey()]);
      }
    }, graph);
  }

}

export default indexLengthCollectionParser;

const transformIndexLengthCollection = (types, field) => {
  if (isIndexLengthCollection(types, field)) {
    return field
      .set('range', List.of('to', 'from'))
      .updateIn(['type'], type => type.changeKind('OBJECT', 'INDEX_LENGTH_COLLECTION'));
  } else {
    return field;
  }
}

const isIndexLengthCollection = (types, field) => {
  // TODO: should also test that it has to / from args
  const baseType = field.type.baseType();
  if (field.type.baseType().kind === 'OBJECT') {
    const type = types.get(baseType.name);
    const lengthField = type.fields.find(field => field.name === 'length');
    const nodesField = type.fields.find(field => field.name === 'nodes');

    return lengthField
      && lengthField.type.baseType().kind === 'SCALAR'
      && lengthField.type.baseType().name === 'Int'
      && nodesField
      && nodesField.type.containsKind('LIST');
  } else {
    return false;
  }
}

const rangeToArguments = (range) => {
  return List.of(
    new Argument({name: 'from', value: range.from}),
    new Argument({name: 'to', value: range.to})
  );
}
