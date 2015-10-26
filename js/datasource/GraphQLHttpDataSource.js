import request from 'superagent';
import {AsyncSubject} from 'rx';

import Parser from './impl/Parser';
import stringifyQuery from './impl/stringifyQuery';

export default class GraphQLHttpDataSource {

  constructor(url, jsonSchema) {
    this.url = url;
    this.parser = new Parser(jsonSchema);
  }

  get(paths) {
    const query = this.parser.pathSetsToQuery(paths);

    const subject = new AsyncSubject();

    request.post(this.url)
      .send({ query: stringifyQuery(query) })
      .end((err, response) => {
        if (err) {
          subject.onError(err);
        } else {
          const jsonGraph = this.parser.responseToJsonGraph(query, response.body.data);
          console.log('graph', JSON.stringify(jsonGraph, null, 2));
          subject.onNext(jsonGraph);
          subject.onCompleted();
        }
      });

    return subject;
  }

}
