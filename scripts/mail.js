var _  = require('lodash')
  , fs = require('fs')
  , Q  = require('q');

var mailgun = new require('mailgun-js')({
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOAMAIN
});

var emailFrom = 'postmaster@slowstogo.com';
var emailTo = 'catering@slowstogo.com';

module.exports = {
  'log': log
}

function log(body) {
  var defer = Q.defer();

  if (body._gotcha){
    defer.resolve({'next': body._next, 'body': body});
    return defer.promise;
  }

  Q.allSettled([requestEmail(body), confirmEmail(body)])
    .then(function (results) {
      var output = {'next': body._next, 'messages': []}
      var errors = [];
      results.forEach(function (result) {
        //google analytics here
        if (result.state === "fulfilled") {
          output.messages.push(result.value);
        } else {
          errors.push(result.reason);
          output.error = errors;
        }
      });

      defer.resolve(output);

    });

  // confirmEmail(body).then(function(results){
  //
  // }, function(err){
  //   defer.reject(err);
  // })


  return defer.promise;
}



function requestEmail(body){
  var defer = Q.defer();
  var email = [body.name, ' <'+emailFrom+'>'].join('');

  var _body = fs.readFileSync('./templates/body.html', "utf8");
  body.s = fs.readFileSync('./templates/td-style.txt', "utf8");
  body.requestedTime = new Date().toLocaleString();

  var emailBody = _.template(_body)(body);


  var data = {
    from: email,
    to: resolveTo(body._targets, emailTo),
    subject: body._subject + ': ' + guestCount(body.guest_count) + ' guests, from ' + body.name,
    html: emailBody,
    'h:Reply-To': body._replyto
  }
  // defer.resolve('response')
  // Invokes the method to send emails given the above data with the helper library
  mailgun.messages().send(data, function (err, response) {
      //If there is an error, render the error page
      if (err) {
          defer.reject(err);
          console.log("got an error: ", err);
      }
      else {
          defer.resolve(response)
          console.log(response);
      }
  });

  return defer.promise;
}


function confirmEmail(body){
  var defer = Q.defer();

  var _body = fs.readFileSync('./templates/confirm.html', "utf8");
  body.s = fs.readFileSync('./templates/td-style.txt', "utf8");
  body.emailTo = emailTo;
  body = normalizeTime(body);
  var emailBody = _.template(_body)(body);

  var data = {
    from: emailFrom,
    to: body._replyto,
    subject: 'Confirmation: ' + body._subject,
    html: emailBody,
    'h:Reply-To': emailTo
  }

  // defer.resolve('response')
  // Invokes the method to send emails given the above data with the helper library
  mailgun.messages().send(data, function (err, response) {
      //If there is an error, render the error page
      if (err) {
          defer.reject(err);
          console.log("got an error: ", err);
      }
      else {
          defer.resolve(response)
          console.log(response);
      }
  });

  return defer.promise;
}

function resolveTo(encoded, _default) {
  //fail fast
  if(!encoded || encoded.length < 1){
    return _default
  }
  return encoded.repalce('[at]', '@').replace('[dot]', '.');
}

function normalizeTime(body){
  body.start_time = fixTime(body.start_time);
  body.end_time = fixTime(body.end_time);
  return body;
}

function fixTime(t) {
	var hours = parseInt(t.split(':')[0]);
  var mins = parseInt(t.split(':')[1]);

  if (hours >= 1 && hours <= 12) {
	  return t + ' am';
  }
  if (hours == 0) {
  	return '12' + ':' + mins + ' am';
  }
  if (hours > 12) {
  	return (hours - 12) + ':' + mins + ' pm';
  }
}

function guestCount(guests){
  if(guests < 50){
    return '< 50';
  } else if (guests < 100){
    return '50-100';
  } else if (guests < 150){
    return '100-150';
  } else {
    return '> 150';
  }
}
