import {List,Map,Record} from 'immutable';

import {isObject} from './utils';

// types / fields / SCALAR should be treated as opaque tokens outside this file
class Type extends Record({
  name: undefined,
  scalar: false,
  fields: Map()
}) { }

class Field extends Record({
  name: undefined,
  type: undefined,
  args: List()
}) { }

export const SCALAR = 'scalar';

var field = (key, def) => {
  if (isObject(def)) {
    return new Field({
      name: key,
      type: def.type,
      args: List(def.args)
    });
  } else {
    return new Field({
      name: key,
      type: def
    });
  }
}

var type = (key, def) => {
  if (def === SCALAR) {
    return new Type({
      name: key,
      scalar: true
    });
  } else {
    return new Type({
      name: key,
      fields: Map(Object.keys(def).map(key => {
        return [key, field(key, def[key])];
      }))
    });
  }
}

// private -- want flexibility to change the schema data structure
var getBaseType = (schema, name) => {
  var type;
  if (name instanceof Type) {
    type = name;
  } else if (name instanceof Field) {
    type = getBaseType(schema, name.type);
  } else if (Array.isArray(name)) {
    var baseName = name[name.length - 1];
    type = schema.types.get(baseName);
  } else {
    type = schema.types.get(name);
  }

  if (!type) {
    throw `Could not find type ${name}`;
  } else {
    return type;
  }
}

export class Schema extends Object {
  constructor(types) {
    super(types);
    this.types = types;
  }

  getField(typeOrField, name) {
    var type = getBaseType(this, typeOrField);
    var field = type.fields.get(name);
    if (!field) {
      throw `Could not find field ${name} on ${type.name}`;
    } else {
      return field;
    }
  }

  getQueryType() {
    return this.types.get('Query');
  }

  isScalar(field) {
    return getBaseType(this, field).scalar;
  }

  isReferenceable(field) {
    return !!this.getReferenceRoot(field);
  }

  isCollection(field) {
    var typeId = field.type;
    return Array.isArray(typeId) &&
      typeId.indexOf('list') !== -1 &&
      field.args.size >= 2 &&
      field.args.get(0) === 'from' &&
      field.args.get(1) === 'to';
  }

  getReferenceRoot(field) {
    var type = getBaseType(this, field);
    if (!type.scalar && type.fields.has('id')) {
      return this.getQueryType().fields
        .filter(field => field.args.size === 1 && field.args.get(0) === 'id')
        .find(root => root.type === type.name);
    }
  }

  // TODO: add metadata to types / fields
  // could determine reference roots / isCollection / isReferenceable once
  // in this method instead of per call
  static create(defs) {
    return new Schema(Map(Object.keys(defs).map(key => {
      return [key, type(key, defs[key])];
    })));
  }
}
