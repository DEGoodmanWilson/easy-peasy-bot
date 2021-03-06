/**
 * A Bot for Slack!
 */


/**
 * Define a function for initiating a conversation on installation
 * With custom integrations, we don't have a way to find out who installed us, so we can't message them :(
 */

function onInstallation(bot, installer) {
    if (installer) {
        bot.startPrivateConversation({user: installer}, function (err, convo) {
            if (err) {
                console.log(err);
            } else {
                convo.say('I am a bot that has just joined your team');
                convo.say('You must now /invite me to a channel so that I can be of use!');
            }
        });
    }
}


/**
 * Configure the persistence options
 */

var config = {};
if (process.env.MONGODB_URI) {
    var BotkitStorage = require('botkit-storage-mongo');
    config = {
        storage: BotkitStorage({mongoUri: process.env.MONGODB_URI}),
    };
} else {
    config = {
        json_file_store: ((process.env.TOKEN)?'./db_slack_bot_ci/':'./db_slack_bot_a/'), //use a different name if an app or CI
    };
}

// config.logLevel = 7;

/**
 * Are being run as an app or a custom integration? The initialization will differ, depending
 */

if (process.env.TOKEN || process.env.SLACK_TOKEN) {
    //Treat this as a custom integration
    var customIntegration = require('./lib/custom_integrations');
    var token = (process.env.TOKEN) ? process.env.TOKEN : process.env.SLACK_TOKEN;
    var controller = customIntegration.configure(token, config, onInstallation);
} else if (process.env.CLIENT_ID && process.env.CLIENT_SECRET && process.env.PORT) {
    //Treat this as an app
    var app = require('./lib/apps');
    var controller = app.configure(process.env.PORT, process.env.CLIENT_ID, process.env.CLIENT_SECRET, config, onInstallation);
} else {
    console.log('Error: If this is a custom integration, please specify TOKEN in the environment. If this is an app, please specify CLIENT_ID, CLIENT_SECRET in the environment');
    process.exit(1);
}


/**
 * A demonstration for how to handle websocket events. In this case, just log when we have and have not
 * been disconnected from the websocket. In the future, it would be super awesome to be able to specify
 * a reconnect policy, and do reconnections automatically. In the meantime, we aren't going to attempt reconnects,
 * WHICH IS A B0RKED WAY TO HANDLE BEING DISCONNECTED. So we need to fix this.
 *
 * TODO: fixed b0rked reconnect behavior
 */
// Handle events related to the websocket connection to Slack
controller.on('rtm_open', function (bot) {
    console.log('** The RTM api just connected!');
});

controller.on('rtm_close', function (bot) {
    console.log('** The RTM api just closed');
    // you may want to attempt to re-open
});


/**
 * Core bot logic goes here!
 */
// BEGIN EDITING HERE!

controller.on('bot_channel_join', function (bot, message) {
    bot.reply(message, "I'm here!")
});

controller.middleware.receive.use(function(bot, message, next) {

    var finishedCount = 0;
    function done() {
        finishedCount += 1;
        if (finishedCount === 2) {
            next();
        }
    }

    if (message.user) {
      controller.storage.users.get(message.user, function(error, user_data) {
          if (error) {
              console.error(error);
              done();
          } else if (user_data === null) {
              console.log('user is not present in storage, caching.', message.user);
              bot.api.users.info({ user: message.user }, function(error, response) {
                  if (error) {
                      console.error(error);
                      done();
                  } else {
                      console.log('retrieved user from web api', message.user);
                      controller.storage.users.save(response.user, function(error) {
                          if (error) {
                              console.error(error);
                          } else {
                              console.log('user cached to storage', message.user);
                          }
                          done();
                      });
                  }
              });
          } else {
              console.log('user already exists in storage, not updating.', message.user);
              done();
          }
      });
    } else {
      done();
    }

    if (message.channel) {
      controller.storage.channels.get(message.channel, function(error, channel_data) {
          if (error) {
              console.error(error);
              done();
          } else if (channel_data === null) {
              console.log('channel is not present in storage, caching.', message.channel);
              bot.api.channels.info({ channel: message.channel }, function(error, response) {
                  if (error) {
                      console.error(error);
                      done();
                  } else {
                      console.log('retrieved channel from web api', message.channel);
                      controller.storage.channels.save(response.channel, function(error) {
                          if (error) {
                              console.error(error);
                          } else {
                              console.log('channel cached to storage', message.channel);
                          }
                          done();
                      });
                  }
              });
          } else {
              console.log('channel already exists in storage, not updating.', message.channel);
              done();
          }
      });
    } else {
      done();
    }
});

controller.hears('hello', ['ambient', 'mention', 'direct_mention', 'direct_message'], function (bot, message) {
    console.log("hello from ");
    console.dir(message);
    bot.reply(message, 'Hello!');
});


/**
 * AN example of what could be:
 * Any un-handled direct mention gets a reaction and a pat response!
 */
//controller.on('direct_message,mention,direct_mention', function (bot, message) {
//    bot.api.reactions.add({
//        timestamp: message.ts,
//        channel: message.channel,
//        name: 'robot_face',
//    }, function (err) {
//        if (err) {
//            console.log(err)
//        }
//        bot.reply(message, 'I heard you loud and clear boss.');
//    });
//});
