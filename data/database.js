class Event extends Object { }
class Organization extends Object { }
class Repository extends Object { }

var events = [];
for(var i = 0; i < 10; i++) {
  var event = new Event();
  event.id = i;
  event.description = `Hardcoded Event ${i}`;
  events.push(event);
}

var organizations = {
  69631: {
    id: 69631,
    login: 'facebook',
    name: 'Facebook',
    description: 'We work hard to contribute our work back to the web, mobile, big data, & infrastructure communities. NB: members must have two-factor auth.',
    public_repos: 148,
    created_at: '2009-04-02T03:35:22Z',
    repos: [10270250],
    repos_url: 'https://api.github.com/orgs/facebook/repos',
    events_url: 'https://api.github.com/orgs/facebook/events',
  },
  8261421: {
    id: 8261421,
    login: 'rackt',
    name: '',
    description: 'Quality code from the React.js community',
    public_repos: 13,
    created_at: '2014-07-24T21:20:03Z',
    repos: [19872456, 20636942, 20980532],
    repos_url: 'https://api.github.com/orgs/rackt/repos',
    events_url: 'https://api.github.com/orgs/rackt/events',
  }
};

var repositories = {
  10270250: {
    id: 10270250,
    name: 'react',
    full_name: 'facebook/react',
    description: 'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
    organization: {
      id: 69631
    }
  },
  19872456: {
    id: 19872456,
    name: 'react-router',
    full_name: 'rackt/react-router',
    description: 'A complete routing solution for React.js',
    organization: {
      id: 8261421
    }
  },
  20636942: {
    id: 20636942,
    name: 'react-autocomplete',
    full_name: 'rackt/react-autocomplete',
    description: 'WAI-ARIA compliant React autocomplete (combobox) component',
    organization: {
      id: 8261421
    }
  },
  20980532: {
    id: 20980532,
    name: 'react-boilerplate',
    full_name: 'rackt/react-boilerplate',
    description: '',
    organization: {
      id: 8261421
    }
  },
}

module.exports = {
  getEvent: (id) => events.find((ev) => ev.id === id),
  getEvents: () => events,
  getOrganization: (id) => Object.assign(new Organization(), organizations[id]),
  getRepository: (id) => repositories[id],
  getRepositories: (ids) => {
    console.log('ids', ids);
    return ids ? ids.map(id => repositories[id]) : []
  },
  Event,
  Organization,
  Repository
}
