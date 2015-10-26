import {List,Map,Record} from 'immutable';

export class TypeDefinition extends Record({
  kind: undefined,
  name: undefined,
  fields: List()
}) { }

export class FieldDefinition extends Record({
  name: undefined,
  type: undefined,
  args: List(),
  range: List()
}) {
  // arguments with range arguments removed
  basicArgs() {
    return this.args.filterNot(arg => this.range.includes(arg.name));
  }
}

export class Argument extends Record({
  name: undefined,
  type: undefined
}) {
  isRequired() {
    // can NON_NULL be an inner kind and still be required?
    // e.g. LIST [ NON_NULL [ INT ]] would not be required ... I think ...
    //      but is there a case where it would be?
    return this.type.kind === 'NON_NULL';
  }
}

export class Type extends Record ({
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

  containsKind(kind) {
    if (this.kind === kind) {
      return true;
    } else if (this.ofType) {
      return this.ofType.containsKind(kind);
    } else {
      return false;
    }
  }

  changeKind(oldKind, newKind) {
    if (this.kind === oldKind) {
      return this.set('kind', newKind);
    } else if (this.ofType) {
      return this.update('ofType', ofType => ofType.changeKind(oldKind, newKind));
    } else {
      return this;
    }
  }
}

export function getField(types, type, name) {
  if (type instanceof TypeDefinition) {
    var field = type.fields.find(field => field.name === name);
    if (!field) {
      throw `Field ${name} not found on type ${type.name}`;
    }
    return field;
  } else if (type instanceof Type) {
    if (type.ofType) {
      return getField(types, type.ofType, name);
    } else {
      var typeDefinition = types.get(type.name);
      return getField(types, typeDefinition, name);
    }
  } else {
    throw `Unexpected type ${type}. Expected instance of TypeDefinition or Type`;
  }
}

export function mapFields (types, fn) {
  return types.map(type => (
    type.update('fields', fields => fields.map(fn))
  ));
}

export function jsonToTypes (json) {
  const types = Map(
    json.data.__schema.types
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
      })])
  );

  return [
    types,
    types.get(json.data.__schema.queryType.name)
  ];
}

const toType = (json) => {
  if (json) {
    return new Type({
      kind: json.kind,
      name: json.name,
      ofType: toType(json.ofType)
    });
  }
};
