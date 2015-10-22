export function stringifyQuery (query) {
  var rootStrings = query.map(stringifyField);
  return `query { ${rootStrings.join(', ')} }`;
}

var stringifyName = (query) => {
  if (query.alias()) {
    return `${query.alias()}:${query.name}`;
  } else {
    return query.name;
  }
}

var stringifyField = (query) => {
  return `${stringifyName(query)}${stringifyArgs(query)}${stringifyChildren(query.children)}`;
}

var stringifyChildren = (children) => {
  if (children.isEmpty()) {
    return '';
  } else {
    var fieldStrings = children.map(stringifyField);
    return ` { ${fieldStrings.join(', ')} } `;
  }
}

var stringifyArgValue = (query, arg) => {
  // TODO: make this proper, stringify for scalar / inputObject / list types / etc
  var fieldArg = query.field.args.find(farg => farg.name === arg.name);
  if (fieldArg && fieldArg.type.baseType().name === 'String') {
    return `"${arg.value}"`;
  } else {
    return `${arg.value}`;
  }
}

var stringifyArgs = (query) => {
  var args = query.args;
  if (args.isEmpty()) {
    return '';
  } else {
    var argStrings = args.map(arg => `${arg.name}: ${stringifyArgValue(query, arg)}`);
    return `(${argStrings.join(', ')})`;
  }
}
