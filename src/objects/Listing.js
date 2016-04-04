'use strict';
const _ = require('lodash');
const Promise = require('bluebird');
const promise_wrap = require('promise-chains');
const errors = require('../errors');

const INTERNAL_DEFAULTS = {
  _query: {},
  _show: 'all',
  _transform: _.identity,
  _method: 'get',
  _is_comment_list: false,
  _limit: undefined,
  _link_id: undefined,
  _uri: undefined,
  _more: undefined,
  after: undefined,
  before: undefined
};

/**
* A class representing a list of content. This is a subclass of the native Array object, so it has all the properties of
an Array (length, forEach, etc.) in addition to some added methods. The Listing can be extended by using the
[#fetch_more()]{@link Listing#fetch_more}, [#fetch_until]{@link Listing#fetch_until}, and
[#fetch_all()]{@link Listing#fetch_all} functions. Note that these methods return new Listings, rather than mutating the
original Listing.

* Most methods that return Listings will also accept `limit`, `after`, `before`, `show`, and `count` properties.
* @extends Array
*/
const Listing = class extends Array {
  constructor (options = {}, _ac) {
    super();
    _.assign(this, options.children || []);
    _.defaults(this, _.pick(options, _.keys(INTERNAL_DEFAULTS)), INTERNAL_DEFAULTS);
    this._ac = _ac;
    if (_.last(options.children) instanceof require('./more')) {
      this._more = this.pop();
      this._is_comment_list = true;
    }
  }
  /**
  * @summary This is a getter that is true if there are no more items left to fetch, and false otherwise.
  */
  get is_finished () {
    if (this._more) {
      return !this._more.children.length;
    }
    return !this._uri || this.after === null && this.before === null;
  }
  /**
  * @summary Fetches some more items
  * @param {object} options
  * @param {number} options.amount The number of items to fetch.
  * @param {boolean} [options.skip_replies=false] For a Listing that contains comment objects on a Submission, this option can
  be used to save a few API calls, provided that only top-level comments are being examined. If this is set to `true`, snoowrap
  is able to fetch 100 Comments per API call rather than 20, but all returned Comments will have no fetched replies by default.
  *
  * Internal details: When `skip_replies` is set to `true`, snoowrap uses reddit's `api/info` endpoint to fetch Comments. When
  `skip_replies` is set to `false`, snoowrap uses reddit's `api/morechildren` endpoint. It's worth noting that reddit does
  not allow concurrent requests to the `api/morechildren` endpoint by the same account.
  * @returns {Promise} A new Listing containing all of the elements in this Listing followed by the newly-fetched elements
  */
  fetch_more (options) {
    const parsed_options = _.defaults(_.isObject(options) ? options : {amount: options}, {skip_replies: false});
    if (!_.isNumber(parsed_options.amount)) {
      throw new errors.InvalidMethodCallError('Failed to fetch Listing. (No amount specified.)');
    }
    if (parsed_options.amount <= 0 || this.is_finished) {
      return promise_wrap(Promise.resolve(this._clone()));
    }
    return promise_wrap(this._more ? this._fetch_more_comments(parsed_options) : this._fetch_more_regular(parsed_options));
  }
  async _fetch_more_regular (options) {
    const limit = this._is_comment_list ? options.amount + 1 : options.amount;
    return this._ac[`_${this._method}`]({
      uri: this._uri,
      qs: _.defaults({after: this.after, before: this.before, limit, show: this._show}, this._query)
    }).then(this._transform).then(response => {
      const cloned = this._clone();
      cloned.push(..._.toArray(response));
      cloned.before = response.before;
      cloned.after = response.after;
      return cloned.fetch_more({...options, amount: options.amount - response.length});
    });
  }
  /* Pagination for comments works differently than it does for most other things; rather than sending a link to the next page
  within a Listing, reddit sends the last comment in the list as as a `more` object, with links to all the remaining comments
  in the thread. */
  async _fetch_more_comments (...args) {
    const cloned = this._clone();
    if (this._more) {
      const more_comments = await this._more.fetch_more(...args);
      cloned.push(..._.toArray(more_comments));
      cloned._more.children.splice(0, cloned.length - this.length);
    }
    return cloned;
  }
  /**
  * @summary Fetches all of the items in this Listing, only stopping when there are none left.
  * @param {object} [options]
  * @param {boolean} [options.skip_replies=false] See {@link Listing#fetch_more}
  * @returns {Promise} A new fully-fetched Listing. Keep in mind that this method has the potential to exhaust your
  ratelimit quickly if the Listing doesn't have a clear end (e.g. with posts on the front page), so use it with discretion.
  */
  fetch_all (options) {
    return this.fetch_more({...options, amount: Infinity});
  }
  /**
  * @summary Fetches items until a given length is reached.
  * @param {object} options
  * @param {number} options.length The maximum length that the Listing should have after completion. The length might end up
  being less than this if the true number of available items in the Listing is less than `$0.length`. For example, this
  can't fetch 200 comments on a Submission that only has 100 comments in total.
  * @param {boolean} [options.skip_replies=false] See {@link Listing#fetch_more}
  * @returns {Promise} A new Listing containing all of the elements in this Listing followed by the newly-fetched elements
  */
  fetch_until (options) {
    if (!_.isNumber(options.length)) {
      throw new errors.InvalidMethodCallError('Failed to fetch Listing. (No amount specified.)');
    }
    return this.fetch_more({...options, amount: options.length - this.length});
  }
  inspect () {
    return `Listing ${require('util').inspect(_.toArray(this))}`;
  }
  _clone () {
    const properties = _.pick(this, _.keys(INTERNAL_DEFAULTS));
    properties._more = this._more && this._more._clone();
    properties.children = _.toArray(this);
    return new Listing(properties, this._ac);
  }
};

module.exports = Listing;
