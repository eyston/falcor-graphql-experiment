import {List,Map,Record} from 'immutable';

class Query extends Record({
  field: undefined,
  alias: undefined,
  args: List(),
  children: List()
}) {
  responseKey() {
    return this.alias || this.field.name;
  }
  graphKey() {
    return this.field.name;
  }
};


var pop = (stack) => {
  return [stack.first(), stack.pop()];
}

var addReferenceId = (schema, field, children) => {
  if (schema.isReferenceable(field) && !children.some(child => child.name === 'id')) {
    var idField = schema.getField(field, 'id');

    return children.push(new Query({
      field: idField
    }))
  } else {
    return children;
  }
}

var nonCollectionArgs = (schema, field) => {
  if (schema.isCollection(field)) {
    return field.args.slice(2);
  } else {
    return field.args;
  }
}

var parseCollectionArgs = (schema, field, path) => {
  // test if list and first 2 args are 'from' and 'to'
  if (schema.isCollection(field)) {
    var [value, rest] = pop(path);
    var args = List()
      .push(Map({name: 'to', value: value.to}))
      .push(Map({name: 'from', value: value.from || 0}));

    return {args, path: rest};
  } else {
    return {args: List(), path};
  }
}

var parseArgs = (schema, field, path) => {
  var collectionArgs = parseCollectionArgs(schema, field, path);

  return nonCollectionArgs(schema, field).reduce(({args, path}, arg) => {
    var [value, rest] = pop(path);
    return {args: args.push(Map({name: arg, value})), path: rest};
  }, collectionArgs);
}

var parseChildren = (schema, parent, path) => {
  if (path.isEmpty()) {
    return List();
  } else {
    var [names, rest] = pop(path);
    if (Array.isArray(names)) {
      return List(names).map((name) => {
        return parseField(schema, schema.getField(parent, name), rest);
      });
    } else {
      return List([parseField(schema, schema.getField(parent, names), rest)]);
    }
  }
}

var makeCRCTable = function(){
    var c;
    var crcTable = [];
    for(var n =0; n < 256; n++){
        c = n;
        for(var k =0; k < 8; k++){
            c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        crcTable[n] = c;
    }
    return crcTable;
}

var crcTable = makeCRCTable();

var crc32 = function(str) {
    var crc = 0 ^ (-1);

    for (var i = 0; i < str.length; i++ ) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
    }

    return (crc ^ (-1)) >>> 0;
};

var fieldAlias = (field, args) => {
  if (!args.isEmpty()) {
    var slug = args.map(arg => `.${arg.get('name')}(${arg.get('value')})`).join('');
    return `${field.name}${Math.abs(crc32(slug)).toString(36)}`;
  }
}

var parseField = (schema, field, path) => {
  var {args, path: rest} = parseArgs(schema, field, path);
  var children = parseChildren(schema, field, rest);
  return new Query({
    field: field,
    alias: fieldAlias(field, args),
    args: args,
    children: addReferenceId(schema, field, children)
  });
}

var parseRoot = (schema, path) => {
  var [name, rest] = pop(path);
  var root = schema.getQueryType();
  return parseField(schema, schema.getField(root, name), rest);
}

export function parsePath (schema, path) {
  return parseRoot(schema, path);
}

var stringifyName = (field) => {
  if (field.alias) {
    return `${field.alias}:${field.field.name}`;
  } else {
    return field.field.name;
  }
}

var stringifyField = (field) => {
  return `${stringifyName(field)}${stringifyArgs(field.get('args'))}${stringifyChildren(field.get('children'))}`;
}

var stringifyChildren = (children) => {
  if (children.isEmpty()) {
    return '';
  } else {
    var fieldStrings = children.map(stringifyField);
    return ` { ${fieldStrings.join(', ')} } `;
  }
}

var stringifyArgs = (args) => {
  if (args.isEmpty()) {
    return '';
  } else {
    var argStrings = args.map(arg => `${arg.get('name')}: ${arg.get('value')}`);
    return `(${argStrings.join(', ')})`;
  }
}

export function stringifyQuery (query) {
  var rootStrings = query.map(stringifyField);
  return `query { ${rootStrings.join(', ')} }`;
}
