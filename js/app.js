import json from 'json!../data/schema.json';

import GraphQLHttpDataSource from './datasource/GraphQLHttpDataSource';
import {args} from './datasource/arguments';

var model = new falcor.Model({
  source: new GraphQLHttpDataSource('/graphql', json)
});

model.get(
  ['organization', 'facebook', ['id', 'name', 'description']],
  ['organization', 'facebook', 'created', ['month', 'day', 'year']],
  ['organization', 'facebook', 'updated', ['month', 'day', 'year']],
  ['repository', 'facebook/react', 'organization', ['name', 'description']],
  ['organization', 'facebook', 'repositories', {from: 5, length: 5}, ['name', 'description']],
  ['organization', 'facebook', 'repositoriesWithArgs', args({startsWith: 'r'}), {length: 5}, ['name']],
  ['organization', 'facebook', 'repositoriesWithArgs', args(), {length: 1}, ['name']],
  ['organization', 'facebook', 'repositoriesWithLength', 'length'],
  ['organization', 'facebook', 'repositoriesWithLength', {length: 2}, ['name', 'description']],
  ['organization', 'facebook', 'repositoriesWithCursor', {from: 5, length: 5}, ['name']],
  ['organization', 'facebook', 'thumbnail', [args(), args({height:200}), args({width:100, height:100})]],
  ['repository', 'facebook/react', ['id', 'name', 'description']],
  ['repository', 'facebook/react', 'organization', 'repositories', { length: 5 }, ['name', 'description']]
  ).then(graph => {
  console.log(JSON.stringify(graph, null, 2));
});

setTimeout(() => {
  model.get(
    ['organization', 'facebook', 'repositoriesWithCursor', {from: 5, length: 10}, ['name']]
  ).subscribe(graph => {
    console.log(JSON.stringify(graph, null, 2));
  });

}, 2000);
