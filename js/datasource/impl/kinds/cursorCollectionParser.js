import {List,Map,Range,Record} from 'immutable';

import {mapFields,getField} from '../schema';

import {
  Query,
  Argument,
  isRange,
  parsePathSetRange,
  parsePathSetField,
} from '../query';

import {
  parseQueryResponse

} from '../graph';

const cursorCollectionParser = {

  transformTypes(types) {
    return mapFields(types, field =>
      transformCursorCollection(types, field)
    );
  },

  pathSet(ctx, query, field, path) {
    const {types,fullPath,cursors} = ctx;

    if (isRange(path.first())) {
      const {range, path: rest} = parsePathSetRange(path);

      const edgesField = getField(types, field.type, 'edges');
      const nodeField = getField(types, edgesField.type, 'node');
      const cursorField = getField(types, edgesField.type, 'cursor');

      const edgesQuery = Query.build(edgesField, Map({children: List.of(
        parsePathSetField(ctx, Query.build(nodeField), nodeField, rest),
        Query.build(cursorField)
      )}));

      return query
        .update('args', args => args.concat(rangeToCursorArguments(cursors, prefixPath(fullPath, path), range)))
        .set('children', List.of(edgesQuery));
    } else {
      return query.set('children', parseType(ctx, field.type, path));
    }
  },

  response(ctx, graph, path, query, response) {
    return query.children.reduce((graph, child) => {
      if (child.name === 'edges') {
        const after = query.args.find(arg => arg.name === 'after');
        const startIndex = after ? getIndex(ctx.cursors, path, after.value) + 1 : 0;
        const endIndex = startIndex + query.args.find(arg => arg.name === 'first').value - 1;
        const edges = response.edges || [];
        const nodeQuery = child.children.find(c => c.name === 'node');

        return Range(startIndex, endIndex + 1).reduce((graph, collectionIndex, responseIndex) => {
          if (edges[responseIndex] && edges[responseIndex].node) {
            ctx.cursors = addCursor(ctx.cursors, path, collectionIndex, edges[responseIndex].cursor);
            return parseQueryResponse(ctx, graph, path, nodeQuery.set('name', collectionIndex), edges[responseIndex].node);

          } else {
            return graph.setIn(qp.push(collectionIndex), $atom());
          }
        }, graph);
      } else {
        return parseQueryResponse(ctx, graph, path, child, response[child.responseKey()]);
      }
    }, graph);
  }

}

export default cursorCollectionParser;

const transformCursorCollection = (types, field) => {
  if (isCursorCollection(types, field)) {
    return field
      .set('range', List.of('first', 'after', 'last', 'before'))
      .updateIn(['type'], type => type.changeKind('OBJECT', 'CURSOR_COLLECTION'));
  } else {
    return field;
  }
}

const isCursorCollection = (types, field) => {
  const baseType = field.type.baseType();
  if (baseType.kind === 'OBJECT'
      && field.args.find(arg => arg.name === 'after')
      && field.args.find(arg => arg.name === 'first')) {
    const type = types.get(baseType.name);

    const edgesField = type.fields.find(field => field.name === 'edges');

    return edgesField && edgesField.type.containsKind('LIST');
  } else {
    return false;
  }
}

const prefixPath = (fullPath, path) => {
  return fullPath.take(fullPath.size - path.size);
}

const rangeToCursorArguments = (cursors, path, range) => {
  const cursor = getCursor(cursors, path, range.from);

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

class Cursor extends Record({
  value: undefined,
  index: undefined
}) { };

const getCursor = (cursors, path, index) => {
  // iterate from index to 0 finding the first cursor or undefiend
  // super inefficient but pretty fun
  return Range(index, 0, -1)
    .map(i => {
      const value = cursors.getIn(path.toList().push(i));
      if (value) {
        return new Cursor({value, index: i});
      }
    })
    .find(c => c);
}

const addCursor = (cursors, path, index, cursor) => {
  return cursors.setIn(path.push(index), cursor);
}

const getIndex = (cursors, path, cursor) => {
  return cursors.getIn(path).findKey((c, _) => c === cursor);
}
