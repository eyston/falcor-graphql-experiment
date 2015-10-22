import querystring from 'querystring';

import {List,Stack,Map,Record,Range} from 'immutable';
import request from 'superagent';
import {Observable,AsyncSubject} from 'rx';

import {Schema} from './schema';
import {parsePath} from './query';
import {stringifyQuery} from './stringify';
import {parseResponse} from './graph';

import json from 'json!../data/schema.json';

var schema = Schema.fromJSON(json);

console.log('schema', JSON.stringify(schema, null, 2));

class GraphQLDataSource extends Object {

  get(paths) {
    var query = List(paths).map(Stack).flatMap(path => parsePath(schema, path));

    console.log('path', JSON.stringify(paths, null, 2));
    console.log('query', JSON.stringify(query, null, 2));
    console.log('query string', stringifyQuery(query));

    var subject = new AsyncSubject();

    request.post('/graphql')
      .send({ query: stringifyQuery(query) })
      .end((err, response) => {
        if (err) {
          subject.onError(err);
        } else {
          console.log('response', JSON.stringify(response.body.data, true, 2));
          var jsonGraph = parseResponse(schema, query, response.body.data);
          // jsonGraph.paths = paths;
          console.log(JSON.stringify(jsonGraph, true, 2));
          subject.onNext(JSON.parse(JSON.stringify(jsonGraph))); // WTF?
          // subject.onNext(jsonGraph);
          subject.onCompleted();
        }
      });

    return subject;
  }

  set(...args) {
    console.log('args', args);
  }

  call(...args) {
    console.log('args', args);
  }
}

var $ref = falcor.Model.ref;

var model = new falcor.Model({
  source: new GraphQLDataSource()
});

var args = (obj) => {
  if (obj) {
    return querystring.stringify(obj);
  } else {
    return '__default__';
  }
}

// model.getValue(['repository', 10270250, 'organization', 'link', 'REPOS']).then((name) => {
//   console.log(name);
// });

model.get(
  ['repository', 19872456, 'organization', ['name', 'id', 'description']],
  ['repository', 19872456, 'organization', 'repositories', args(), { length: 5 }, ['name', 'description']],
  ['repository', 19872456, 'organization', 'repositories', args({startsWith: 'r'}), { length: 5 }, ['name', 'description']],
  ['repository', 19872456, 'organization', 'repositoriesTres', { length: 5 }, ['name', 'description']],
  ['repository', 19872456, 'organization', 'repositoriesTres', 'length'],
  ['repository', 19872456, 'name'],
  ['repositoryByName', 'react-router', ['id', 'name', 'description']]
  ).then((graph) => {
  console.log(JSON.stringify(graph, null, 2));
});

// model.get(
//   ['repository', 19872456, 'organization', ['name', 'description']]).then((graph) => {
//   console.log(JSON.stringify(graph, null, 2));
// });

// model.get(
//   ['repository', 10270250, 'organization', ['id', 'name', 'description']],
//   ['repository', 19872456, 'organization', ['id', 'name', 'description']]).then((graph) => {
//   console.log(JSON.stringify(graph, null, 2));
// });

// model.get(
//   ['repository', 10270250, 'organization', 'thumbnail', 'width=100']).then((graph) => {
//   console.log(JSON.stringify(graph, null, 2));
// });

// model.get(
//   ['repository', 10270250, 'organization', 'thumbnail', 'width=100&height=200']).then((graph) => {
//   console.log(JSON.stringify(graph, null, 2));
// });

// model.get(
//   ['repository', 10270250, 'organization', 'thumbnail', '__default__']).then((graph) => {
//   console.log(JSON.stringify(graph, null, 2));
// });

// model.get(
//   ['repository', 10270250, 'organization', 'thumbnail', ['__default__', 'height=200', 'width=25&height=25']]).then((graph) => {
//   console.log(JSON.stringify(graph, null, 2));
// });

// model.get(
//   ['repository', 10270250, 'organization', 'thumbnail', [args(), args({height: 200}), args({width: 25, height: 25})]]).then((graph) => {
//   console.log(JSON.stringify(graph, null, 2));
// });


// model.get(
//   ['repository', 10270250, 'organization', 'updated', ['month', 'day', 'year']],
//   ['repository', 10270250, 'organization', 'created', ['month', 'day', 'year']]).then((graph) => {
//   console.log(JSON.stringify(graph, null, 2));
// });

// model.get(
//   ['repository', 10270250, 'organization', 'name'],
//   ['repository', 19872456, 'organization', 'name']).then((graph) => {
//   console.log(JSON.stringify(graph, null, 2));
// });

// model.get(
//   ['repository', 10270250, 'organization', 'name'],
//   ['repository', 10270250, 'organization', 'link', 'REPOS'],
//   ['repository', 19872456, 'organization', 'description']).then((graph) => {
//   console.log(JSON.stringify(graph, null, 2));
// });

// model.get(['organization', 8261421, 'repositoriesDos', 'startsWith="r"&orderBy="name"', {from: 1, to: 2}, ['name', 'description']]).then(graph => {
//   console.log(JSON.stringify(graph, null, 2));
// });

// model.get(['organization', 8261421, 'repositoriesDos', '__default__', {from: 1, to: 2}, ['name', 'description']]).then(graph => {
//   console.log(JSON.stringify(graph, null, 2));
// });
//
// model.get('organization[69631].repositories[0..10].name').then(graph => {
//   console.log(graph);
// });

// model.get(
//   ['organization', 69631, 'repositories', [13, 5, 8, 6], 'name'],
//   ['organization', 69631, 'repositories', {length:21}, 'name']).then(graph => {
//   console.log(graph);
// });


// model.getValue(['repository', 10270250, 'organization', 'link', 'REPOS']).then((name) => {
//   console.log(name);
// });

// console.log(model.getCache());

// model.getValue(['repository', 10270250, 'name']).then((name) => {
//   console.log(name);
// });

// model.getValue(['repository', 234, 'name']).then((name) => {
//   console.log(name);
// });

// model.get(['repository', 234, ['name', 'id']]).then((name) => {
//   console.log(name);
// });

// model.get(['repository', 234, 'organization', 'name']).then((name) => {
//   console.log(name);
// });

// model.getValue(['repository', 1, 'parent', 'description']).then((name) => {
//   console.log(name);
// });
//
// model.getValue(['node', 'organization', 2, 'name']).then((name) => {
//   console.log(name);
// });

// model.get(['repository', 10270250, 'organization', ['name', 'id']]).then((name) => {
//   console.log(name);
// });


// model.getValue(['repository', 123, 'organization', 'name']).then((name) => {
//   console.log(name);
// });
//
// model.getValue(['organization', 456, 'name']).then((name) => {
//   console.log(name);
// });
