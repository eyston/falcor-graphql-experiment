import request from 'superagent';
import {AsyncSubject} from 'rx';
import {List,Stack} from 'immutable';

import {Schema} from './schema';
import {parsePath} from './query';
import {stringifyQuery} from './stringify';
import {parseResponse} from './graph';
import CursorStore from './cursors';

export default class GraphQLHttpDataSource extends Object {

  constructor(url, schema) {
    super();
    this.schema = schema;
    this.url = url;
    this.cursors = new CursorStore();
  }

  get(paths) {
    var query = List(paths).map(Stack).flatMap(path => parsePath(this.schema, path, {cursors:this.cursors}));

    var subject = new AsyncSubject();

    console.log('query', stringifyQuery(query));

    request.post(this.url)
      .send({ query: stringifyQuery(query) })
      .end((err, response) => {
        if (err) {
          subject.onError(err);
        } else {
          console.log('response', JSON.stringify(response.body, null, 2));
          var jsonGraph = parseResponse(this.schema, query, response.body.data, {cursors:this.cursors});
          console.log('graph', JSON.stringify(jsonGraph, null, 2));
          subject.onNext(JSON.parse(JSON.stringify(jsonGraph))); // WTF?
          subject.onCompleted();
        }
      });

    return subject;
  }

  static fromJSON(json) {
    return new GraphQLDataSource(Schema.fromJSON(json));
  }

}
