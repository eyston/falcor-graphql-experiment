import {List,Map,Range} from 'immutable';

var $ref = falcor.Model.ref;

export function parseResponse(schema, queries, response) {
  return Map({ jsonGraph: queries.reduce((graph, query) => {
    return parseQuery(schema, graph, List(), query, response[query.responseKey()]);
  }, Map())}).toJS();
}

var parseQuery = (schema, graph, path, query, response) => {
  var qp = path.concat(queryPath(schema, query));
  if (schema.isScalar(query.field)) {
    return graph.setIn(qp, response);
  } else if (response === undefined || response === null) {
    return graph.setIn(qp, null);
  } else if (schema.isCollection(query.field)) {
      var startIndex = query.range.find(arg => arg.get('name') === 'from').get('value');
      var endIndex = query.range.find(arg => arg.get('name') === 'to').get('value');

      var element = query
        .updateIn(['field', 'type'], type => type[type.length - 1])
        // .setIn(['field', 'args'], List())
        .set('args', List());
        // .updateIn(['field', 'args'], args => args.filterNot(arg => arg === 'to' || arg === 'from'))
        // .setIn(['field', 'args'], List())
        // .updateIn(['args'], args => args);

      // qp = path.concat(queryPath(element));
      qp = path.concat(queryPath(schema, query));

      return Range(startIndex, endIndex + 1).reduce((graph, collectionIndex, responseIndex) => {
          return parseQuery(schema, graph, qp, element.setIn(['field', 'name'], collectionIndex), response[responseIndex] || null);
      }, graph);
  } else if (schema.isReferenceable(query.field) && !path.isEmpty()) {
    var root = schema.getReferenceRoot(query.field);
    var reference = query
      .set('field', root)
      .set('args', List([Map({name: 'id', value: response.id })]));

    return parseQuery(schema, graph.setIn(qp, $ref(queryPath(schema, reference))), List(), reference, response);
  } else {
    return query.children.reduce((graph, query) => {
      return parseQuery(schema, graph, qp, query, response[query.responseKey()]);
    }, graph);
  }
}

var nonRangeArgs = (schema, field) => {
  if (schema.isCollection(field)) {
    return field.args.filterNot(arg => arg === 'to' || arg === 'from');
  } else {
    return field.args;
  }
}

var queryPath = (schema, query) => {
  var field = query.field;
  var args = nonRangeArgs(schema, field);
  if (args.isEmpty()) {
    return List([query.graphKey()]);
  } else if (args.size === 1 && query.args.size === 1) {
    return List([query.graphKey()]).push(query.args.first().get('value'));
  } else if (args.size > 1 && !query.args.isEmpty()) {
    return List([query.graphKey()]).push(query.args.map(arg => {
      return `${arg.name}=${arg.value}`;
    }).join('&'));
  } else {
    return List([query.graphKey()]);
  }
  // return List([query.graphKey()]).concat(query.args.map(arg => arg.get('value')));
}
