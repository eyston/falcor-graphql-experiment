import {List,Map,Range} from 'immutable';

var $ref = falcor.Model.ref;

export function parseResponse(schema, queries, response) {
  return Map({ jsonGraph: queries.reduce((graph, query) => {
    return parseQuery(schema, graph, queryPath(schema, query), query, response[query.name]);
  }, Map())}).toJS();
}

var parseQuery = (schema, graph, path, query, response) => {
  if (schema.isScalar(query.field)) {
    return graph.setIn(path, response);
  } else if (response === undefined || response === null) {
    return graph.setIn(path, null);
  } else if (schema.isCollection(query.field)) {
      var startIndex = query.args.find(arg => arg.get('name') === 'from').get('value');
      var endIndex = query.args.find(arg => arg.get('name') === 'to').get('value');

      var element = query
        .updateIn(['field', 'type'], type => type[type.length - 1])
        .updateIn(['field', 'args'], args => args.filterNot(arg => arg === 'to' || arg === 'from'))
        .updateIn(['args'], args => args.filterNot(arg => arg.get('name') === 'to' || arg.get('name') === 'from'));

      return Range(startIndex, endIndex + 1).reduce((graph, collectionIndex, responseIndex) => {
          return parseQuery(schema, graph, path.push(collectionIndex), element, response[responseIndex] || null);
      }, graph);
  } else if (schema.isReferenceable(query.field) && query.field !== schema.getReferenceRoot(query.field)) {
    var root = schema.getReferenceRoot(query.field);
    var reference = query
      .set('field', root)
      .set('args', List([Map({name: 'id', value: response.id })]))
      .set('name', root.name);

    return parseQuery(schema, graph.setIn(path, $ref(queryPath(schema, reference))), queryPath(schema, reference), reference, response);
  } else {
    return query.children.reduce((graph, query) => {
      return parseQuery(schema, graph, path.concat(queryPath(schema, query)), query, response[query.name]);
    }, graph);
  }
}

var queryPath = (schema, query) => {
  if (schema.isCollection(query.field)) {
    var element = query
      .updateIn(['field', 'type'], type => type[type.length - 1])
      .updateIn(['field', 'args'], args => args.filterNot(arg => arg === 'to' || arg === 'from'))
      .updateIn(['args'], args => args.filterNot(arg => arg.get('name') === 'to' || arg.get('name') === 'from'));
    return queryPath(schema, element);
  } else {
    return List([query.name]).concat(query.args.map(arg => arg.get('value')));
  }
}
