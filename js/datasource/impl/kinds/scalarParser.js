const scalarParser = {

  pathSet(ctx, query, field, path) {
    if (!path.isEmpty()) {
      throw `path should be empty after SCALAR kind but was ${path.toJS()}`
    }

    return query;
  },

  response(ctx, graph, path, query, response) {
    return graph.setIn(path, response);
  }

}

export default scalarParser;
