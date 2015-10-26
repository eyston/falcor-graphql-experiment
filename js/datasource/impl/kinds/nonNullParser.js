import {parsePathSetFieldInnerKind} from '../query';
import {parseQueryInnerTypeResponse} from '../graph';

const nonNullParser = {
  pathSet: parsePathSetFieldInnerKind,
  response: parseQueryInnerTypeResponse
}

export default nonNullParser;
