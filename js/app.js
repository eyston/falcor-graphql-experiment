import {List,Stack,Map,Record,Range} from 'immutable';
import request from 'superagent';
import {Observable,AsyncSubject} from 'rx';

import {Schema,SCALAR} from './schema';
import {parsePath, stringifyQuery} from './query';
import {parseResponse} from './graph';

var schema = Schema.create({
  // scalars
  string: SCALAR,
  int: SCALAR,

  // complex
  Repository: {
    id: 'int',
    name: 'string',
    organization: 'Organization',
    description: 'string',
  },
  Organization: {
    id: 'int',
    name: 'string',
    link: { type: 'string', args: ['type'] },
    description: 'string',
    repositories: { type: ['list', 'Repository'], args: ['from', 'to'] },
    repositoriesDos: { type: ['list', 'Repository'], args: ['from', 'to', 'startsWith', 'orderBy']}
  },

  // root
  Query: {
    repository: { type: 'Repository', args: ['id'] },
    organization: { type: 'Organization', args: ['id'] }
  }
});

console.log('schema', JSON.stringify(schema, null, 2));

class GraphQLDataSource extends Object {

  get(paths) {
    var query = paths.map(Stack).map(path => parsePath(schema, path));

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
          console.log(JSON.stringify(jsonGraph, true, 2));
          subject.onNext(JSON.parse(JSON.stringify(jsonGraph)));
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

// model.getValue(['repository', 10270250, 'organization', 'link', 'REPOS']).then((name) => {
//   console.log(name);
// });


// model.get(
//   ['repository', 10270250, 'organization', ['name', 'id', 'description']],
//   ['repository', 10270250, 'organization', 'repositories', { to: 4 }, ['id', 'name']],
//   ['repository', 10270250, 'name']).then((graph) => {
//   console.log(graph);
// });

// model.get(
//   ['repository', 19872456, 'organization', ['name', 'description']]).then((graph) => {
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

model.get(['organization', 8261421, 'repositoriesDos', '__default__', {from: 1, to: 2}, ['name', 'description']]).then(graph => {
  console.log(JSON.stringify(graph, null, 2));
});

// model.get('organization[69631].repositories[0..10].name').then(graph => {
//   console.log(graph);
// });

// model.getValue(['organization', 69631, 'repositories', 7, 'name']).then(name => {
//   console.log(name);
// });


// model.getValue(['repository', 10270250, 'organization', 'link', 'REPOS']).then((name) => {
//   console.log(name);
// });

// console.log(model.getCache());

// model.getValue(['repository', 123, 'name']).then((name) => {
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
