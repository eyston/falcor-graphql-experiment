import {List,Map,Stack} from 'immutable';

import {jsonToTypes} from './schema';
import {pathSetToQuery} from './query';
import {parseQueryResponse} from './graph';

import {
  referenceParser,
  indexCollectionParser,
  indexLengthCollectionParser,
  cursorCollectionParser
} from './kinds';


export default class Parser {

  constructor(jsonSchema) {
    [this.types, this.queryType] = jsonToTypes(jsonSchema);

    this.types = referenceParser.transformTypes(this.types, this.queryType);
    this.types = indexCollectionParser.transformTypes(this.types);
    this.types = indexLengthCollectionParser.transformTypes(this.types);
    this.types = cursorCollectionParser.transformTypes(this.types);

    this.cursors = Map();
  }

  pathSetsToQuery(paths) {
    return List(paths)
      .map(Stack)
      .flatMap(path => pathSetToQuery({
        types: this.types,
        queryType: this.queryType,
        cursors: this.cursors,
        fullPath: path
      }, path));
  }

  responseToJsonGraph(queries, response) {
    var jsonGraph = queries.reduce((graph, query) => {
      return parseQueryResponse(this, graph, List(), query, response[query.responseKey()]);
    }, Map());

    return {
      // the JSON.parse/stringify is required ...
      // .toJS() doesn't work, falcor throws errors
      // think it has to do with iterators or something but who knows!
      // sucks to suck :(
      jsonGraph: JSON.parse(JSON.stringify(jsonGraph))
    }
  }

}
