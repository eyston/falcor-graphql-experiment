import {List} from 'immutable';

import {Type,mapFields,getField} from '../schema';

import {Query,Argument,parsePathSetFieldInnerKind} from '../query';
import {parseQueryResponse,queryPath} from '../graph';

const $ref = falcor.Model.ref;

const referenceParser = {

  transformTypes(types, queryType) {
    return mapFields(types, field =>
      transformReference(types, queryType, field)
    );
  },

  pathSet(ctx, query, field, path) {
    const {types} = ctx;
    return parsePathSetFieldInnerKind(ctx, query, field, path)
      .update('children', children =>
        addReferenceIdField(types, field, children)
      );
  },

  response(ctx, graph, path, query, response) {
    const {types,queryType} = ctx;
    const root = getRoot(types, queryType, query.field.type);

    // create a reference query to parse from ...
    const reference = query
      .set('field', root)
      // TODO: this is gross ...
      .set('name', root.name)
      // TODO: this is more gross ...
      .set('args', List.of(new Argument({name: 'id', value: response.id})));

    return parseQueryResponse(
      ctx,
      graph.setIn(path, $ref(queryPath(reference))),
      List(),
      reference,
      response
    );
  }
}

export default referenceParser;

const addReferenceIdField = (types, field, children) => {
  if (children.find(child => child.name === 'id')) {
    return children;
  } else {
    const idField = getField(types, field.type, 'id');
    return children.push(Query.build(idField));
  }
}

const transformReference = (types, queryType, field) => {
  const root = getRoot(types, queryType, field.type);
  if (root) {
    return field.updateIn(['type'], makeReference);
  } else {
    return field;
  }
}

const getRoot = (types, queryType, fieldType) => {
  if (fieldType.ofType) {
    return getRoot(types, queryType, fieldType.ofType);
  } else {
    return queryType.fields.find(field => isRoot(fieldType, field));
  }
}

const isRoot = (type, field) => {
  return field.type !== type
    && field.type.equals(type)
    && field.args.size === 1
    && field.args.first().name === 'id';
}

const makeReference = (type) => {
  if (type.ofType) {
    return type.updateIn(['ofType'], ofType => makeReference(ofType));
  } else {
    return new Type({kind: 'REFERENCE', ofType: type});
  }
}
