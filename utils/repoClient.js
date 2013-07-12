var GitHubApi = require("github"),
    RepositoryClient;

function RepositoryClient(config) {
    this.user = config.username;
    this.org = config.organization;
    this.repo = config.repository;
    this.contributorsUrl = config.contributors;
    this.github = new GitHubApi({
        version: '3.0.0',
        timeout: 5000
    });
    this.github.authenticate({
        type: 'basic',
        username: this.user,
        password: config.password
    });
}

RepositoryClient.prototype.merge = function(head, base, callback) {
    console.log('merging ' + head + ' into ' + base + '...');
    this.github.repos.merge({
        user: this.org,
        repo: this.repo,
        base: base,
        head: head
    }, callback);
};

RepositoryClient.prototype.isBehindMaster = function(sha, callback) {
    this.github.repos.compareCommits({
        user: this.org,
        repo: this.repo,
        base: 'master',
        head: sha
    }, function(err, data) {
        if (err) {
            callback(err);
        } else {
            callback(err, data.behind_by > 0, data.behind_by);
        }
    });
};

RepositoryClient.prototype.getAllOpenPullRequests = function(callback) {
    this.github.pullRequests.getAll({
        user: this.org,
        repo: this.repo,
        state: 'open'
    }, callback);
};

RepositoryClient.prototype.getAllStatusesFor = function(sha, callback) {
    this.github.statuses.get({
        user: this.org,
        repo: this.repo,
        sha: sha
    }, function(err, statuses) {
        callback(err, (statuses || []));
    });
};

RepositoryClient.prototype.confirmWebhookExists = function(url, events, callback) {
    var me = this;
    this.github.repos.getHooks({
        user: this.org,
        repo: this.repo
    }, function(err, hooks) {
        var found = false;
        if (err) {
            return callback(err);
        }
        hooks.forEach(function(hook) {
            if (url == hook.config.url) {
                found = true;
            }
        });
        if (! found) {
            me.github.repos.createHook({
                user: me.org,
                repo: me.repo,
                name: 'web', 
                config: {
                    url: url
                },
                events: events
            }, function(err, data) {
                if (err) {
                    return callback(err);
                }
                callback(null, data);
            });
        } else {
            callback();
        }
    });
};

RepositoryClient.prototype.toString = function() {
    return this.org + '/' + this.repo;
};

module.exports = RepositoryClient;