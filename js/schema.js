import {List,Map,Record} from 'immutable';

class TypeDefinition extends Record({
  kind: undefined,
  name: undefined,
  fields: List()
}) { }

class FieldDefinition extends Record({
  name: undefined,
  type: undefined,
  args: List()
}) { }

class Argument extends Record({
  name: undefined,
  type: undefined
}) {
  isRequired() {
    return this.type.kind === 'NON_NULL';
  }
}

class Type extends Record ({
  kind: undefined,
  name: undefined,
  ofType: null
}) {
  baseType() {
    if (this.ofType) {
      return this.ofType.baseType();
    } else {
      return this;
    }
  }
}

var toType = (json) => {
  if (json) {
    return new Type({
      kind: json.kind,
      name: json.name,
      ofType: toType(json.ofType)
    });
  }
};

var mapFields = (schema, fn) => {
  return schema.types.map(type => {
    return type.updateIn(['fields'], (fields) => fields.map(field => fn(schema, field)));
  });
}

var isRoot = (type, field) => {
  return field.type !== type
    && field.type.equals(type)
    && field.args.size === 1
    && field.args.first().name === 'id';
}

var getRoot = (schema, fieldType) => {
  if (fieldType.ofType) {
    return getRoot(schema, fieldType.ofType);
  } else {
    var query = schema.getQueryType();
    return query.fields.find(field => isRoot(fieldType, field));
  }
}

var makeReference = (type) => {
  if (type.ofType) {
    return type.updateIn(['ofType'], ofType => makeReference(ofType));
  } else {
    return new Type({kind: 'REFERENCE', ofType: type});
  }
}

var referenceTransformer = (schema, field) => {
  var root = getRoot(schema, field.type);
  if (root) {
    return field.updateIn(['type'], type => makeReference(type));
  } else {
    return field;
  }
}

var containsKind = (type, kind) => {
  if (type.kind === kind) {
    return true;
  } else if (type.ofType) {
    return containsKind(type.ofType, kind);
  } else {
    return false;
  }
}

var changeKind = (type, kind, newKind) => {
  if (type.kind === kind) {
    return type.set('kind', newKind);
  } else if (type.ofType) {
    return type.updateIn(['ofType'], ofType => changeKind(ofType, kind, newKind));
  } else {
    return type;
  }
}

var isIndexCollection = (field) => {
  // TODO: maybe add type checks that to / from are int?
  return containsKind(field.type, 'LIST')
    && field.args.find(arg => arg.name === 'to')
    && field.args.find(arg => arg.name === 'from');
}

var indexCollectionTransformer = (schema, field) => {
  if (isIndexCollection(field)) {
    return field
      .updateIn(['args'], args => args.filterNot(arg => arg.name === 'to' || arg.name === 'from'))
      .updateIn(['type'], type => changeKind(type, 'LIST', 'INDEX_COLLECTION'));
  } else {
    return field;
  }
}


export class Schema extends Object {

  constructor(types, queryTypeName) {
    super();

    this.types = types;
    this.queryTypeName = queryTypeName;

    this.types = mapFields(this, referenceTransformer);
    this.types = mapFields(this, indexCollectionTransformer);

    // TODO: verify query type exists
    // TODO: verify all types in fields / args have a type definition
  }

  getQueryType() {
    return this.types.get(this.queryTypeName);
  }

  getField(type, name) {
    if (type instanceof TypeDefinition) {
      var field = type.fields.find(field => field.name === name);
      if (!field) {
        throw `Field ${name} not found on type ${type.name}`;
      }
      return field;
    } else if (type instanceof Type) {
      if (type.ofType) {
        return this.getField(type.ofType, name);
      } else {
        var typeDefinition = this.types.get(type.name);
        return this.getField(typeDefinition, name);
      }
    } else {
      throw `Unexpected type ${type}. Expected instance of TypeDefinition or Type`;
    }
  }

  getReferenceField(type) {
    if (type.ofType) {
      return this.getReferenceField(type.ofType);
    } else {
      var query = this.getQueryType();
      return query.fields.find(field => isRoot(type, field));
    }
  }

  static fromJSON(json) {
    var types = Map(json.data.__schema.types
      .filter(type => type.name.indexOf('__') !== 0) // remove the schema types
      .map(type => [type.name, new TypeDefinition({
        kind: type.kind,
        name: type.name,
        fields: List(type.fields).map(field => new FieldDefinition({
          name: field.name,
          type: toType(field.type),
          args: List(field.args).map(arg => new Argument({
            name: arg.name,
            type: toType(arg.type)
          }))
        }))
      })]));

    return new Schema(types, json.data.__schema.queryType.name);
  }
}
