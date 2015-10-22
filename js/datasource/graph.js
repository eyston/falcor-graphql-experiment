import {List,Map,Range,Record} from 'immutable';

import {Argument} from './query';
import {slugFromArguments} from './arguments';

var $ref = falcor.Model.ref;
var $atom = falcor.Model.atom;

class Context extends Record({
  schema: undefined,
  cursors: undefined,
}) { }

export function parseResponse(schema, queries, response, opts) {
  var ctx = new Context({schema, ...opts});
  return Map({jsonGraph: queries.reduce((graph, query) => {
    return parseQuery(ctx, graph, List(), query, response[query.responseKey()]);
  }, Map())}).toJS();
}

var parseQuery = (ctx, graph, path, query, response) => {

  if (!response) {
    return graph.setIn(path.concat(queryPath(query)), 'null');
  }

  switch(query.field.type.kind) {
    case 'OBJECT':
      return parseObject(ctx, graph, path, query, response);
    case 'SCALAR':
      return parseScalar(ctx, graph, path, query, response);
    case 'NON_NULL':
      return parseNonNull(ctx, graph, path, query, response);
    case 'REFERENCE':
      return parseReference(ctx, graph, path, query, response);
    case 'INDEX_COLLECTION':
      return parseIndexCollection(ctx, graph, path, query, response);
    case 'INDEX_LENGTH_COLLECTION':
      return parseIndexLengthCollection(ctx, graph, path, query, response);
    case 'CURSOR_COLLECTION':
      return parseCursorCollection(ctx, graph, path, query, response);
    default:
      throw `Unhandled kind ${query.field.type.kind}`;
  }
}

var queryPath = (query) => {
  var field = query.field;
  var args = field.basicArgs();

  var basicArgs = query.args.filter(qarg => field.basicArgs().find(farg => farg.name === qarg.name));

  if (args.isEmpty()) {
    return List([query.name]);
  } else if (args.size === 1 && args.first().isRequired()) {
    return List([query.name]).push(query.args.first().value);
  } else if (args.size > 1) {
    return List([query.name]).push(slugFromArguments(basicArgs));
  }
}


var parseObject = (ctx, graph, path, query, response) => {
  var qp = path.concat(queryPath(query));
  return query.children.reduce((graph, query) => {
    return parseQuery(ctx, graph, qp, query, response[query.responseKey()]);
  }, graph);
}

var parseScalar = (ctx, graph, path, query, response) => {
  var qp = path.concat(queryPath(query));
  return graph.setIn(qp, response);
}

var parseInnerType = (ctx, graph, path, query, response) => {
  return parseQuery(ctx, graph, path, query.updateIn(['field', 'type'], type => type.ofType), response);
}

var parseNonNull = parseInnerType;

var parseReference = (ctx, graph, path, query, response) => {
  var qp = path.concat(queryPath(query));

  var root = ctx.schema.getReferenceField(query.field.type);
  var reference = query
    .set('field', root)
    // TODO: this is gross ...
    .set('name', root.name)
    // TODO: this is gross ...
    .set('args', List.of(new Argument({name: 'id', value: response.id})));

  return parseQuery(ctx, graph.setIn(qp, $ref(queryPath(reference))), List(), reference, response);
}

var parseIndexCollection = (ctx, graph, path, query, response) => {

  var startIndex = query.args.find(arg => arg.name === 'from').value;
  var endIndex = query.args.find(arg => arg.name === 'to').value;

  var qp = path.concat(queryPath(query));

  var element = query.set('args', List()).setIn(['field', 'args'], List()); // meh

  return Range(startIndex, endIndex + 1).reduce((graph, collectionIndex, responseIndex) => {
    if (response[responseIndex]) {
      return parseInnerType(ctx, graph, qp, element.set('name', collectionIndex), response[responseIndex]);
    } else {
      return graph.setIn(qp.push(collectionIndex), $atom());
    }
  }, graph);
}

var parseIndexLengthCollection = (ctx, graph, path, query, response) => {

  var qp = path.concat(queryPath(query));

  return query.children.reduce((graph, child) => {
    if (child.name === 'nodes') {
      var startIndex = query.args.find(arg => arg.name === 'from').value;
      var endIndex = query.args.find(arg => arg.name === 'to').value;
      var nodes = response.nodes || [];

      return Range(startIndex, endIndex + 1).reduce((graph, collectionIndex, responseIndex) => {
        if (nodes[responseIndex]) {
          return parseInnerType(ctx, graph, qp, child.set('name', collectionIndex), nodes[responseIndex]);
        } else {
          return graph.setIn(qp.push(collectionIndex), $atom());
        }
      }, graph);
    } else {
      return parseQuery(ctx, graph, qp, child, response[child.responseKey()]);
    }
  }, graph);
}

var parseCursorCollection = (ctx, graph, path, query, response) => {

  var qp = path.concat(queryPath(query));

  return query.children.reduce((graph, child) => {
    if (child.name === 'edges') {
      var after = query.args.find(arg => arg.name === 'after');
      var startIndex = after ? ctx.cursors.getIndex(qp, after.value) + 1 : 0;
      var endIndex = startIndex + query.args.find(arg => arg.name === 'first').value - 1;
      var edges = response.edges || [];
      var nodeQuery = child.children.find(c => c.name === 'node');

      return Range(startIndex, endIndex + 1).reduce((graph, collectionIndex, responseIndex) => {
        if (edges[responseIndex] && edges[responseIndex].node) {
          ctx.cursors.addCursor(qp, collectionIndex, edges[responseIndex].cursor);
          return parseInnerType(ctx, graph, qp, nodeQuery.set('name', collectionIndex), edges[responseIndex].node);
        } else {
          return graph.setIn(qp.push(collectionIndex), $atom());
        }
      }, graph);
    } else {
      return parseQuery(ctx, graph, qp, child, response[child.responseKey()]);
    }
  }, graph);
}
