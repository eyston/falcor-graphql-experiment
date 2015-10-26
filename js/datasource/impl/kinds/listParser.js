import {parsePathSetFieldInnerKind} from '../query';


const nonNullParser = {
  pathSet: parsePathSetFieldInnerKind,
  response() {
    throw 'TODO';
  }
}

export default nonNullParser;
