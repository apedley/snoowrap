import helpers from '../helpers';
import RedditContent from './RedditContent';
const api_type = 'json';

/**
* A set of mixin functions that apply to Submissions, Comments, and PrivateMessages
* <style> #ReplyableContent {display: none} </style>
* @extends RedditContent
*/
const ReplyableContent = class extends RedditContent {
  /**
  * @summary Removes this Comment, Submission or PrivateMessage from public listings.
  * @desc This requires the authenticated user to be a moderator of the subreddit with the `posts` permission.
  * @param {object} $0
  * @param {boolean} [$0.spam=false] Determines whether this should be marked as spam
  * @returns {Promise} A Promise that fulfills with this content when the request is complete
  * @example r.get_comment('c08pp5z').remove({spam: true})
  */
  remove ({spam = false} = {}) {
    return this._post({uri: 'api/remove', form: {spam, id: this.name}}).return(this);
  }
  /**
  * @summary Approves this Comment, Submission, or PrivateMessage, re-adding it to public listings if it had been removed
  * @returns {Promise} A Promise that fulfills with this content when the request is complete
  * @example r.get_comment('c08pp5z').remove()
  */
  approve () {
    return this._post({uri: 'api/approve', form: {id: this.name}}).return(this);
  }
  /**
  * @summary Reports this content anonymously to subreddit moderators (for Comments and Submissions)
  or to the reddit admins (for PrivateMessages)
  * @param {object} [$0]
  * @param {string} [$0.reason] The reason for the report
  * @returns {Promise} A Promise that fulfills with this content when the request is complete
  * @example r.get_comment('c08pp5z').report({reason: 'Breaking the subreddit rules'})
  */
  report ({reason} = {}) {
    return this._post({uri: 'api/report', form: {
      api_type, reason: 'other', other_reason: reason, thing_id: this.name
    }}).return(this);
  }
  /**
  * @summary Ignores reports on this Comment, Submission, or PrivateMessage
  * @returns {Promise} A Promise that fulfills with this content when the request is complete
  * @example r.get_comment('c08pp5z').ignore_reports()
  */
  ignore_reports () {
    return this._post({uri: 'api/ignore_reports', form: {id: this.name}}).return(this);
  }
  /**
  * @summary Unignores reports on this Comment, Submission, or PrivateMessages
  * @returns {Promise} A Promise that fulfills with this content when the request is complete
  * @example r.get_comment('c08pp5z').unignore_reports()
  */
  unignore_reports () {
    return this._post({uri: 'api/unignore_reports', form: {id: this.name}}).return(this);
  }
  /**
  * @summary Submits a new reply to this object. (This takes the form of a new Comment if this object is a Submission/Comment,
  or a new PrivateMessage if this object is a PrivateMessage.)
  * @param {string} text The content of the reply, in raw markdown text
  * @returns {Promise} A Promise that fulfills with the newly-created reply
  * @example r.get_submission('4e60m3').reply('This was an interesting post. Thanks.');
  */
  reply (text) {
    return this._post({
      uri: 'api/comment',
      form: {api_type, text, thing_id: this.name}
    }).tap(helpers._handle_json_errors(this)).then(res => res.json.data.things[0]);
  }
  /**
  * @summary Blocks the author of this content.
  * @desc **Note:** In order for this function to have an effect, this item **must** be in the authenticated account's inbox or
  modmail somewhere. The reddit API gives no outward indication of whether this condition is satisfied, so the returned Promise
  will fulfill even if this is not the case.
  * @returns {Promise} A Promise that fulfills with this message after the request is complete
  * @example
  *
  * r.get_inbox({limit: 1}).then(messages =>
  *   messages[0].block_author();
  * );
  */
  block_author () {
    return this._post({uri: 'api/block', form: {id: this.name}}).return(this);
  }
};

module.exports = ReplyableContent;
