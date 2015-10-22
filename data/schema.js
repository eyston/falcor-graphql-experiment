import {
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLString,
  GraphQLSchema,
  GraphQLInt,
  GraphQLID,
  GraphQLNonNull,
  GraphQLList
} from 'graphql';

import {
  getOrganization,
  Organization,
  getRepository,
  getRepositoryByName,
  getRepositories,
  Repository,
} from './database';

var dot = (field) => {
  return (obj) => obj[field];
}

var dateType = new GraphQLObjectType({
  name: 'Date',
  description: 'A Date',
  fields: () => ({
    day: { type: GraphQLInt, resolve: d => d.getDate() },
    month: { type: GraphQLInt, resolve: d => d.getMonth() + 1 },
    year: { type: GraphQLInt, resolve: d => d.getFullYear() }
  })
});

var repositoryIndexedCollection = new GraphQLObjectType({
  name: 'RepositoryIndexedCollection',
  description: 'A collection with a length',
  fields: () => ({
    length: { type: GraphQLInt },
    nodes: { type: new GraphQLList(repositoryType) }
  })
})

var organizationType = new GraphQLObjectType({
  name: 'Organization',
  description: 'A Github Organization',
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLInt) },
    login: { type: GraphQLString },
    name: { type: GraphQLString },
    description: { type: GraphQLString },
    publicRepos: { type: GraphQLInt, resolve: dot('public_repos') },
    created: { type: dateType, resolve: org => new Date(org.created_at) },
    updated: { type: dateType, resolve: org => new Date(org.created_at) },
    link: {
      type: GraphQLString,
      args: {
        type: { type: new GraphQLNonNull(urlEnum)}
      },
      resolve: (org, args) => org[args.type]
    },
    thumbnail: {
      type: GraphQLString,
      args: {
        width: { type: GraphQLInt, defaultValue: 50 },
        height: { type: GraphQLInt, defaultValue: 50 },
      },
      resolve: (org, args) => `http://placehold.it/${args.width}x${args.height}`
    },
    repositoriesTres: {
      type: repositoryIndexedCollection,
      args: {
        from: { type: GraphQLInt },
        to: { type: GraphQLInt }
      },
      resolve: (org, args) => ({ length: org.repos.length, nodes: getRepositories(org.repos).slice(args.from || 0, (args.to + 1) || 0) })
    },
    repositoriesOld: {
      type: new GraphQLList(repositoryType),
      args: {
        from: { type: new GraphQLNonNull(GraphQLInt) },
        to: { type: new GraphQLNonNull(GraphQLInt) }
      },
      resolve: (org, args) => getRepositories(org.repos).slice(args.from, args.to + 1)
    },
    repositories: {
      type: new GraphQLNonNull(new GraphQLList(repositoryType)),
      args: {
        from: { type: new GraphQLNonNull(GraphQLInt) },
        to: { type: new GraphQLNonNull(GraphQLInt) },
        startsWith: { type: GraphQLString },
        orderBy: { type: GraphQLString }
      },
      resolve: (org, args) => getRepositories(org.repos).slice(args.from, args.to + 1)
        .filter(repo => args.startsWith ? repo.name && repo.name.indexOf(args.startsWith) === 0 : true)
    }
  })
});

var urlEnum = new GraphQLEnumType({
  name: 'URL',
  description: 'Just want an enum for a url parameter to test shit',
  values: {
    REPOS: {
      value: 'repos_url'
    },
    EVENTS: {
      value: 'events_url'
    }
  }
});

var repositoryType = new GraphQLObjectType({
  name: 'Repository',
  description: 'A Github Repository',
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLInt) },
    name: { type: GraphQLString },
    fullName: { type: GraphQLString, resolve: dot('full_name') },
    description: { type: GraphQLString },
    organization: {
      type: organizationType,
      resolve: repo => getOrganization(repo.organization.id)
    },
    organizationDos: {
      type: new GraphQLNonNull(organizationType),
      resolve: repo => getOrganization(repo.organization.id)
    }
  })
});

var queryType = new GraphQLObjectType({
  name: 'Query',
  fields: () => ({
    organization: {
      type: organizationType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLInt) }
      },
      resolve: (_, {id}) => getOrganization(id)
    },
    repository: {
      type: repositoryType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLInt) }
      },
      resolve: (_, {id}) => getRepository(id)
    },
    repositoryByName: {
      type: repositoryType,
      args: {
        name: { type: new GraphQLNonNull(GraphQLString) }
      },
      resolve: (_, {name}) => getRepositoryByName(name)
    }
  })
});

export var Schema = new GraphQLSchema({
  query: queryType
});
