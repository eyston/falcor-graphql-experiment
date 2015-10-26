import {Map} from 'immutable';
import {isObject} from './utils';

export const args = (value = {}) => {
  return JSON.stringify(orderArgs(value));
}

export const slugFromArguments = (argList) => {
  return args(Map(argList.map(arg => [arg.name, arg.value])).toObject());
}

const orderArgs = (value) => {
  if (isObject(value)) {
    let out = {};
    Object.keys(value).sort().forEach(key => out[key] = value[key]);
    return out;
  } else {
    return value;
  }
}
