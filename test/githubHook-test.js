var assert = require('assert');
    proxyquire = require('proxyquire'),
    utilStub = {
        initializeModulesWithin: function() {
            return 'validators to be used';
        },
        lastStatusWasExternal: function(repoClient, sha, cb) {
            cb(true);
        }
    };


describe('github hook handler', function() {
    var validationPerformed = false,
        executedHookCommands = [],
        validatedSHA, validatedUser, validatorsUsed, validationPosted,
        githubHook = proxyquire('./../githubHook', {
            'child_process': {
                exec: function(cmd, cb) {
                    executedHookCommands.push(cmd);
                    cb(null, 'stdout', 'stderr');
                }
            },
            './utils/general': utilStub,
            './utils/shaValidator': {
                performCompleteValidation: function(sha, githubUser, _, validators, postStatus, cb) {
                    console.log(arguments);
                    validationPerformed = true;
                    validatedSHA = sha;
                    validatedUser = githubUser;
                    validatorsUsed = validators;
                    validationPosted = postStatus;
                    cb();
                }
            }
        }),
        mockClients = {'numenta/experiments': {
            hooks: {
                build: 'build hook'
            },
            getCommit: function() {},
            github: {
                statuses: {
                    create: function (statusObj) {
                        validationPosted = statusObj;
                    }
                }
            }
        }},
        handler = githubHook.initializer(mockClients, 'mockConfig');

    it('calls pr handler when sent a mergeable pull_request event', function() {
        var mockPayload = {
                name: 'numenta/experiments',
                pull_request: {
                    action: 'closed',
                    user: {login: 'login'},
                    head: {sha: 'sha'},
                    base: {label: 'label', ref: 'master'},
                    // a travis passing and mergeable PR:
                    merged: false,
                    mergeable: true,
                    mergeable_state: "clean"
                }
            },
            mockRequest = {
                body: {
                    payload: JSON.stringify(mockPayload)
                }
            },
            endCalled = false,
            mockResponse = {
                end: function() {
                    endCalled = true;
                }
            };

        validationPerformed = false;

        handler(mockRequest, mockResponse);

        assert(validationPerformed, 'validation against PR was not performed');
        assert.equal(validatedSHA, 'sha', 'validated wrong SHA');
        assert.equal(validatedUser, 'login', 'validated wrong user');
        assert.equal(validatorsUsed, 'validators to be used', 'used wrong validators');
        assert(validationPosted, 'validation status was not posted');
        assert(endCalled, 'request was not closed');

        // Reset just in case further tests use them.
        validationPerformed = undefined;
        validatedSHA = undefined;
        validatedUser = undefined;
        validatorsUsed = undefined;
        validationPosted = undefined;
    });

    it('does not call pr handler when sent a non-mergeable pull_request event', function(done) {
        var mockPayload = require('./github_payloads/pr_non_mergeable'),
            mockRequest = {
                body: {
                    payload: JSON.stringify(mockPayload)
                }
            },
            mockResponse = {
                end: function() {
                    assert(!validationPerformed, 'validation against PR should not be performed');

                    assert(validationPosted, 'validation status should be posted');

                    assert.equal(validationPosted.state, 'error', 
                        'PR state is wrong');

                    assert.equal(validationPosted.description, 
                        'NuPIC Status: ' + 
                        'Please merge `numenta:master` into `DR:a-feature` and resolve merge conflicts.', 
                        'PR status description is wrong');

                    assert.equal(validationPosted.target_url, 
                        'https://github.com/numenta/experiments/compare/DR:a-feature...numenta:master#commits_bucket',
                        'PR status detail url is wrong');

                    // Reset just in case further tests use them.
                    validationPerformed = undefined;
                    validatedSHA = undefined;
                    validatedUser = undefined;
                    validatorsUsed = undefined;
                    validationPosted = undefined;
                    done();
                }
            };

        handler = githubHook.initializer(mockClients, 'mockConfig');

        validationPerformed = false;

        handler(mockRequest, mockResponse);

    });
    
    // it('calls push handler when sent a push event', function() {});
    
    // it('calls status handler when sent a status event', function() {});

    it('calls one build hook command on master build success status event', function() {
        var mockPayload = require('./github_payloads/status_master_build_success'),
            mockRequest = {
                body: {
                    payload: JSON.stringify(mockPayload)
                }
            };

        handler(mockRequest);

        assert(!validationPerformed, 'validation against PR should not be performed on successful master build.');
        assert(!validationPosted, 'validation status should not be posted on successful master build.');
        assert.equal(executedHookCommands.length, 1, 'Wrong number of hook commands executed.');
        assert.equal(executedHookCommands[0], 'build hook', 'Wrong hook command executed on master build success.');
        // Reset just in case further tests use them.
        validationPerformed = undefined;
        validatedSHA = undefined;
        validatedUser = undefined;
        validatorsUsed = undefined;
        validationPosted = undefined;
        executedHookCommands = [];

    });

    it('does NOT call build hook commands on non-master build success status event', function() {
        var mockPayload = require('./github_payloads/status_non-master_build_success'),
            mockRequest = {
                body: {
                    payload: JSON.stringify(mockPayload)
                }
            };

        handler(mockRequest);

        assert(executedHookCommands.length == 0, 'build hook should NOT have been executed for non-master build success.');

        // Reset just in case further tests use them.
        validationPerformed = undefined;
        validatedSHA = undefined;
        validatedUser = undefined;
        validatorsUsed = undefined;
        validationPosted = undefined;
        executedHookCommands = [];
    });

    it('calls multiple hook commands on master build success status event', function() {
        mockClients = {'numenta/experiments': {
            hooks: {
                build: ['build hook 1', 'build hook 2']
            },
            getCommit: function() {}
        }}
        handler = githubHook.initializer(mockClients, 'mockConfig');
        var mockPayload = require('./github_payloads/status_master_build_success'),
            mockRequest = {
                body: {
                    payload: JSON.stringify(mockPayload)
                }
            };

        handler(mockRequest);

        assert(!validationPerformed, 'validation against PR should not be performed on successful master build.');
        assert(!validationPosted, 'validation status should not be posted on successful master build.');
        assert.equal(executedHookCommands.length, 2, 'Wrong number of hook commands executed.');
        assert.equal(executedHookCommands[0], 'build hook 1', 'Wrong hook command executed on master build success.');
        assert.equal(executedHookCommands[1], 'build hook 2', 'Wrong hook command executed on master build success.');
        // Reset just in case further tests use them.
        validationPerformed = undefined;
        validatedSHA = undefined;
        validatedUser = undefined;
        validatorsUsed = undefined;
        validationPosted = undefined;
        executedHookCommands = [];
    });

});
