import {List,Map,Range} from 'immutable';

import {Argument} from './query';

var $ref = falcor.Model.ref;

export function parseResponse(schema, queries, response) {
  return Map({jsonGraph: queries.reduce((graph, query) => {
    return parseQuery(schema, graph, List(), query, response[query.responseKey]);
  }, Map())}).toJS();
}

var parseQuery = (schema, graph, path, query, response) => {

  if (!response) {
    return graph.setIn(path.concat(queryPath(query)), 'null');
  }

  switch(query.field.type.kind) {
    case 'OBJECT':
      return parseObject(schema, graph, path, query, response);
    case 'SCALAR':
      return parseScalar(schema, graph, path, query, response);
    case 'NON_NULL':
      return parseNonNull(schema, graph, path, query, response);
    case 'REFERENCE':
      return parseReference(schema, graph, path, query, response);
    case 'INDEX_COLLECTION':
      return parseIndexCollection(schema, graph, path, query, response);
    default:
      throw `Unhandled kind ${query.field.type.kind}`;
  }
}

var queryPath = (query) => {
  var field = query.field;
  var args = field.args;
  if (args.isEmpty()) {
    return List([query.graphKey]);
  } else if (args.size === 1 && args.first().isRequired()) {
    return List([query.graphKey]).push(query.args.first().value);
  } else if (args.size > 1 && !query.args.isEmpty()) {
    return List([query.graphKey]).push(query.args.map(arg => {
      return `${arg.name}=${arg.value}`;
    }).join('&'));
  } else {
    // console.log('default', JSON.stringify(field.args, null, 2), JSON.stringify(query.args, null, 2));
    return List([query.graphKey, '__default__']);
  }
}


var parseObject = (schema, graph, path, query, response) => {
  var qp = path.concat(queryPath(query));
  return query.children.reduce((graph, query) => {
    return parseQuery(schema, graph, qp, query, response[query.responseKey]);
  }, graph);
}

var parseScalar = (schema, graph, path, query, response) => {
  var qp = path.concat(queryPath(query));
  return graph.setIn(qp, response);
}

var parseInnerType = (schema, graph, path, query, response) => {
  return parseQuery(schema, graph, path, query.updateIn(['field', 'type'], type => type.ofType), response);
}

var parseNonNull = parseInnerType;

var parseReference = (schema, graph, path, query, response) => {
  var qp = path.concat(queryPath(query));

  var root = schema.getReferenceField(query.field.type);
  var reference = query
    .set('field', root)
    // TODO: this is gross ...
    .set('graphKey', root.name)
    // TODO: this is gross ...
    .set('args', List.of(new Argument({name: 'id', value: response.id})));

  return parseQuery(schema, graph.setIn(qp, $ref(queryPath(reference))), List(), reference, response);
}

var parseIndexCollection = (schema, graph, path, query, response) => {

  var startIndex = query.range.find(arg => arg.name === 'from').value;
  var endIndex = query.range.find(arg => arg.name === 'to').value;

  var qp = path.concat(queryPath(query));

  var element = query.set('args', List()).setIn(['field', 'args'], List()); // meh

  return Range(startIndex, endIndex + 1).toArray().reduce((graph, collectionIndex, responseIndex) => {
    return parseInnerType(schema, graph, qp, element.set('graphKey', collectionIndex), response[responseIndex]);
  }, graph);
}
