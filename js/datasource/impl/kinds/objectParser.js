import {parsePathSetType} from '../query';
import {parseQueryResponse} from '../graph';

const objectParser = {

  pathSet(ctx, query, field, path) {
    return query.set('children', parsePathSetType(ctx, field.type, path));
  },

  response(ctx, graph, path, query, response) {
    return query.children.reduce((graph, query) => {
      return parseQueryResponse(ctx, graph, path, query, response[query.responseKey()]);
    }, graph);
  }

}

export default objectParser;
