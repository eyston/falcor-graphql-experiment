import {Map} from 'immutable';
import {isObject} from './utils';

var orderArgs = (value) => {
  if (isObject(value)) {
    var out = {};
    Object.keys(value).sort().forEach(key => out[key] = value[key]);
    return out;
  } else {
    return value;
  }
}

export var args = (value = {}) => {
  return JSON.stringify(orderArgs(value));
}

export var slugFromArguments = (argList) => {
  return args(Map(argList.map(arg => [arg.name, arg.value])).toObject());
}
