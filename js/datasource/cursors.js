import {Map,Record,Range} from 'immutable';

class Cursor extends Record({
  value: undefined,
  index: undefined
}) { };

export default class CursorStore extends Object {
  constructor() {
    super();
    this.cursors = Map();
  }

  addCursor(path, index, cursor) {
    this.cursors = this.cursors.setIn(path.push(index), cursor);
  }

  getCursor(path, index) {
    // iterate from index to 0 finding the first cursor or undefiend
    return Range(index, 0, -1)
      .map(i => {
        var value = this.cursors.getIn(path.toList().push(i));
        if (value) {
          return new Cursor({value, index: i});
        }
      })
      .find(c => c);
  }

  getIndex(path, cursor) {
    return this.cursors.getIn(path).findKey((c, _) => c === cursor);
  }
}
