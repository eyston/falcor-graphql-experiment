import DataLoader from 'dataloader';
import request from 'superagent';

export class GithubApi extends Object {
  constructor() {
    super();

    this.loader = new DataLoader(urls => new Promise((resolve, reject) => {
      var requests = urls.map(url => new Promise((resolve, reject) => {
        console.log('GET', url);
        request.get(url).end((err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(res.body);
          }
        });
      }));

      Promise.all(requests).then(responses => {
        resolve(responses);
      }, reject);
    }));

    this.baseUrl = 'https://api.github.com/';
  }

  getUrl(url) {
    return this.loader.load(url);
  }

  getRelativeUrl(fragment) {
    return this.loader.load(this.baseUrl + fragment);
  }

  getOrganization(id) {
    return this.getRelativeUrl(`orgs/${id}`);
  }

  getRepository(id) {
    return this.getRelativeUrl(`repos/${id}`);
  }
}
