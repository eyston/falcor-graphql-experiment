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
  connectionArgs,
  connectionDefinitions,
  connectionFromArray,
} from 'graphql-relay';


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
});

var organizationType = new GraphQLObjectType({
  name: 'Organization',
  description: 'A Github Organization',
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLString), resolve: dot('login') },
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
    repositories: {
      type: new GraphQLList(repositoryType),
      args: {
        from: { type: new GraphQLNonNull(GraphQLInt) },
        to: { type: new GraphQLNonNull(GraphQLInt) }
      },
      resolve: (org, args, ctx) => {
        var api = ctx.rootValue.api;
        return api.getUrl(org.repos_url).then(repos => repos.slice(args.from, args.to + 1));
      }
    },
    repositoriesWithArgs: {
      type: new GraphQLNonNull(new GraphQLList(repositoryType)),
      args: {
        from: { type: new GraphQLNonNull(GraphQLInt) },
        to: { type: new GraphQLNonNull(GraphQLInt) },
        startsWith: { type: GraphQLString },
        orderBy: { type: GraphQLString }
      },
      resolve: (org, args, ctx) => {
        var api = ctx.rootValue.api;
        return api.getUrl(org.repos_url).then(repos => repos
          .filter(repo => args.startsWith ? repo.name && repo.name.indexOf(args.startsWith) === 0 : true)
          .slice(args.from, args.to + 1)
        );
      }
    },
    repositoriesWithLength: {
      type: repositoryIndexedCollection,
      args: {
        from: { type: GraphQLInt },
        to: { type: GraphQLInt }
      },
      resolve: (org, args, ctx) => {
        var api = ctx.rootValue.api;
        return api.getUrl(org.repos_url).then(repos => ({
          length: repos && repos.length || 0,
          nodes: repos.slice(args.from || 0, (args.to + 1) || 0)
        }));
      }
    },
    repositoriesWithCursor: {
      type: repositoryConnectionType,
      args: {...connectionArgs},
      resolve: (org, args, ctx) => {
        var api = ctx.rootValue.api;
        return api.getUrl(org.repos_url).then(repos => connectionFromArray(repos, args));
      }
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
    id: { type: new GraphQLNonNull(GraphQLString), resolve: dot('full_name') },
    name: { type: GraphQLString },
    fullName: { type: GraphQLString, resolve: dot('full_name') },
    description: { type: GraphQLString },
    organization: {
      type: organizationType,
      resolve: (repo, _, ctx) => {
        var api = ctx.rootValue.api;
        if (repo.organization) {
          return api.getUrl(repo.organization.url);
        }
      }
    }
  })
});

var {connectionType: repositoryConnectionType} = connectionDefinitions({
  name: 'Repository',
  nodeType: repositoryType
});

var queryType = new GraphQLObjectType({
  name: 'Query',
  fields: () => ({
    organization: {
      type: organizationType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLString) }
      },
      resolve: ({api}, {id}) => api.getOrganization(id)
    },
    repository: {
      type: repositoryType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLString) }
      },
      resolve: ({api}, {id}) => api.getRepository(id)
    }
  })
});

export var Schema = new GraphQLSchema({
  query: queryType
});
