var assert = require('assert'),
    proxyquire = require('proxyquire').noCallThru();

describe('general utilities', function() {
    describe('when initializing dynamic modules', function() {
        var general = proxyquire('./../../utils/general', {
            '../mockDir/a': 'a-mod', 
            '../mockDir/b': 'b-mod', 
            '../mockDir/c': 'c-mod', 
            '../mockDir/d': 'd-mod', 
            '../mockDir/e': 'e-mod',
            'fs': {
                readdirSync: function() {
                    return ['a.js','b.js','c.js','d.js','e.js']
                }
            },
            './repoClient': {}
        });
        it('loads all modules within directory', function() {
            var initialized = general.initializeModulesWithin('mockDir');
            console.log(initialized);
            assert.equal(initialized.length, 5, 'excluded modules were not excluded');
            assert.equal(initialized[0], 'a-mod', 'wrong modules returned');
            assert.equal(initialized[1], 'b-mod', 'wrong modules returned');
            assert.equal(initialized[2], 'c-mod', 'wrong modules returned');
            assert.equal(initialized[3], 'd-mod', 'wrong modules returned');
            assert.equal(initialized[4], 'e-mod', 'wrong modules returned');
        });
        it('ignores excluded modules', function() {
            var initialized = general.initializeModulesWithin('mockDir', ['e','b']);
            assert.equal(initialized.length, 3, 'excluded modules were not excluded');
            assert.equal(initialized[0], 'a-mod', 'wrong modules returned');
            assert.equal(initialized[1], 'c-mod', 'wrong modules returned');
            assert.equal(initialized[2], 'd-mod', 'wrong modules returned');
        });
    });

    it('prevents passwords from showing up in sterilized configs', function() {
        var general = proxyquire('./../../utils/general', {
            'fs': {},
            './repoClient': {}
        });
        var config = {
            "monitors": {
                "project": {
                    "password": "tijj3UikYB9vmx"
                }
            }
        };
        var sterilized = general.sterilizeConfig(config);
        assert.equal('<hidden>', sterilized.monitors.project.password);
    });

    describe('when creating repository clients', function() {

        var mockConfig = {
                "monitors": {
                    "numenta/has-validator": {
                        "username": "dummy",
                        "validators": {
                            "exclude": ["local-exclude"]
                        }
                    },
                    "numenta/has-same-validator": {
                        "username": "dummy",
                        "validators": {
                            "exclude": ["global-exclude"]
                        }
                    },
                    "numenta/has-no-validator": {
                        "username": "dummy"
                    }
                },
                "validators": {
                    "exclude": ["global-exclude"]
                }
            },
            repoClientConfigs = {},
            MockRepoClientClass = function RepoClient(config) {
                repoClientConfigs[config.repository] = config;
            },
            general = proxyquire('./../../utils/general', {
                './repoClient': MockRepoClientClass
            });

        // Mock out the webhook confirmation.
        MockRepoClientClass.prototype.confirmWebhookExists = function(_, _, cb) {
            cb();
        };

        it('does not duplicate validator exclusions', function() {

            general.constructRepoClients('pr-webhook-url', mockConfig, function(clients) {
                var clientConfig = repoClientConfigs['has-same-validator'];
                assert.equal(clientConfig.validators.exclude.length, 1, 
                    'global and local validator exclusions were not merged properly: ' +
                    'validator with only one global exclusion should have 1 in config');
                assert.equal(clientConfig.validators.exclude[0], "global-exclude", 
                    'global and local validator exclusions were not merged properly: ' +
                    'bad value for validator exclusion');
                
            });
        });
        
        it('includes both global and local validator exclusions', function() {

            general.constructRepoClients('pr-webhook-url', mockConfig, function(clients) {
                var clientConfig = repoClientConfigs['has-no-validator'];
                assert.equal(clientConfig.validators.exclude.length, 1, 
                    'global and local validator exclusions were not merged properly: ' +
                    'validator with only one global exclusion should have 1 in config');
                assert.equal(clientConfig.validators.exclude[0], "global-exclude", 
                    'global and local validator exclusions were not merged properly: ' +
                    'bad value for validator exclusion');
                
                clientConfig = repoClientConfigs['has-validator'];
                assert.equal(clientConfig.validators.exclude.length, 2, 
                    'global and local validator exclusions were not merged properly: ' +
                    'validator with both global and local exclusion should have both included in config');
            });
        });



    });
});