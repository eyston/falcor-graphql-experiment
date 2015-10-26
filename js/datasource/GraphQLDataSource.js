import {graphql} from 'graphql';
import {AsyncSubject} from 'rx';

import Parser from './impl/Parser';
import stringifyQuery from './impl/stringifyQuery';

export default class GraphQLDataSource {

  constructor(schema, jsonSchema) {
    this.schema = schema;
    this.parser = new Parser(jsonSchema);
  }

  get(paths) {
    const query = this.parser.pathSetsToQuery(paths);

    const subject = new AsyncSubject();

    graphql(this.schema, stringifyQuery(query)).then(result => {
      // TODO: handle errors?
      if (result.data) {
        const jsonGraph = this.parser.responseToJsonGraph(query, result.data);
        subject.onNext(jsonGraph);
        subject.onCompleted();
      } else {
        subject.onError(result.error);
      }
    });

    return subject;
  }

}
