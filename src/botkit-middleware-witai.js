var Wit = require('node-wit').Wit;


module.exports = function(config) {
    if (!config || !config.accessToken) {
        throw new Error('No wit.ai API token specified');
    }

    if (!config.minimum_confidence) {
        config.minimum_confidence = 0.5;
    }

    const sessions = {};

    function getSession(id) {
        if (!sessions[id]) {
            sessions[id] = {id: id, context: {}};
        }
        return sessions[id];
    }
    function getSessionContext(id) {
        return getSession(id).context;
    }
    function setSessionContext(id, context) {
        getSession(id).context = context;
    }
    function clearResponse(sessionId) {
        let context = getSessionContext(sessionId);
        context.response = null;
    }

    const defaultActions = {
        send(request, response) {
            const {sessionId, context, entities} = request;
            const {text, quickreplies} = response;
            return new Promise(function(resolve, reject) {
                console.log('sending...', JSON.stringify(response));
                if (!context.response) {
                    context.response = { text: [], quickreplies: [] }
                }
                context.response.text.push(text);
                if (quickreplies) {
                    context.response.quickreplies = context.response.quickreplies.concat(quickreplies);
                }
                setSessionContext(sessionId, context);
                return resolve();
            });
        },
        merge({entities, context, message, sessionId}) {
            return new Promise(function(resolve, reject) {
                console.log("merge...");
                return resolve(context);
            });
        },
    };
    
    config.actions = Object.assign({}, defaultActions, config.actions);
    let wit = new Wit(config);

    let middleware = {
        receive(bot, message, next) {
            if (message.text && message.user !== bot.identity.id) {
                clearResponse(message.channel);
                wit.runActions(getSession(message.channel).id, message.text, getSessionContext(message.channel))
                .then((ctx) => {
                    message.witData = getSessionContext(message.channel);
                    next();
                })
                .catch(err => {
                    console.error(err);
                    next();
                });
            }
            else {
                next();
            }
        },
        hears(tests, message) {
            if (message.entities && message.entities.intent) {
                for (var i = 0; i < message.entities.intent.length; i++) {
                    for (var t = 0; t < tests.length; t++) {
                        if (message.entities.intent[i].value == tests[t] &&
                            message.entities.intent[i].confidence >= config.minimum_confidence) {
                            return true;
                        }
                    }
                }
            }

            return false;
        }
    };


    return middleware;
};
