const builder = require('botbuilder'); 
const restify = require('restify'); 
const request = require('request');
require('dotenv').config();

let server = restify.createServer();

server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

let connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

server.post('/api/messages', connector.listen());

let bot = new builder.UniversalBot(connector);

let wordRecognizer = new builder.RegExpRecognizer('SentimentGet', /^word$/i);
let intents = new builder.IntentDialog({ recognizers: [wordRecognizer] })
.onDefault(session => {
    session.send('Type \'word\' to start the sentiment analysis dialog');
    session.send('There you can say something and the score of its sentiment will be measured.');
    session.endDialog('Scores closer to 1 are more positive. Scores closer to 0 are more negative.');
});

bot.dialog('/', intents);


intents.matches('SentimentGet', 'SentimentDialog');

bot.dialog('SentimentDialog', [
    (session, args) => {
        console.log(session.message.text);
        builder.Prompts.text(session, 'Say something and have the utterance\'s sentiment analyzed?');
    },
    (session, results) => {
        sentimentAnalysis(results.response).then(analyticsResponse => {
            session.send(`You said "${results.response}"!`);
            let score = Math.round(analyticsResponse["documents"][0]["score"] * 100) / 100;
            session.send(`The score of that utterance is ${score}`);
            if(score > 0.7) {
                session.endDialog("Wow that's positive!");
            } else if (score > 0.4) {
                session.endDialog("Wow that's neutral-ish...");
            } else {
                session.endDialog("Wow that is not positive.");
            }
        })
    }
]).cancelAction('CancelSentimentDialog', 'Canceled dialog');


let sentimentAnalysis = function (string) {
    let payload = {
        "documents": [{
                "id": "1",
                "text": string ? string : 'No string? This is sad...'
        }]
    }
    return new Promise(function(resolve, reject) {
        request.post(
            'https://westus.api.cognitive.microsoft.com/text/analytics/v2.0/sentiment/', 
            {
                "headers": {
                    "Ocp-Apim-Subscription-Key": process.env.TEXT_ANALYTICS_KEY,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                "body": JSON.stringify(payload)
            }, (err, res, body) => {
                if (err) {
                    return reject(err);
                } else {
                return resolve(JSON.parse(res.body));
                }
            }
        )
    })
}