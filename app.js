// Get dependencies
const redis = require('redis');

// Get configuration
const config = require('./config');

// Env
const env = process.env;

// Args
const args = process.argv.slice(2);

// Get and check session
let sessionid = false;
const regex = /^http\:\/\/127.0.0.1:32400\/video\/:\/transcode\/session\/(.*)\/progress$/;
for (idx in args) {
	if (regex.test(args[idx])) {
		sessionid = args[idx].match(regex)[1];
		break;
	}
}
if (sessionid === false) {
	console.error('Failed to find session id');
	process.exit(1);
}
const propersessionid = sessionid.split('/')[0];
console.log('Session found: ' + sessionid + ' (' + propersessionid + ')');

// Parse arguments
const parsedargs = args.map((o) => {
	if (o.indexOf('/progress') !== -1)
		o = o.replace(config.plex.plex_url, '{PROGRESSURL}/');
	return o.replace(config.plex.plex_url, '{URL}/')
			.replace(config.plex.plex_sessions, '{SRTSRV}/')
			.replace(config.plex.plex_usr, '{USRPLEX}/')
			.replace(config.plex.plex_mount, '{PATH}/')
});

// Replace seglist
const segList = '{SEGURL}/video/:/transcode/session/' + sessionid + '/seglist';
var forceSegList = false;
var finalargs = [];
for (var i = 0; i < parsedargs.length; i++) {
	if (parsedargs[i] == '-segment_list') {
		forceSegList = true;
		finalargs.push(parsedargs[i]);
	}
	else if (forceSegList) {
		finalargs.push(segList);
		if (parsedargs[i + 1] !== '-segment_list_type') {
			finalargs.push('-segment_list_type');
			finalargs.push('csv');
			finalargs.push('-segment_list_size');
			finalargs.push('2147483647');
		}
		forceSegList = false;
	}
	else
		finalargs.push(parsedargs[i]);
}

// Create Redis instance
let redisClient = redis.createClient({
	host:     config.redis.redis_host,
	port:     config.redis.redis_port,
	password: config.redis.redis_pass,
	db:       config.redis.redis_db
});

// On Redis error
redisClient.on('error', (err) => {
	if (err.errno === 'ECONNREFUSED') {
		console.error('Failed to connect to REDIS, please check your configuration');
	}
	else {
		console.error(err.errno);
	}
	process.exit(1);
});

// Send to redis
redisClient.set(propersessionid, JSON.stringify({
	args: finalargs,
	env
}));
