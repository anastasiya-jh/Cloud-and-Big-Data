const os = require('os')
const dns = require('dns').promises
const { program: optionparser } = require('commander')
const { Kafka } = require('kafkajs')
const mysqlx = require('@mysql/xdevapi');
const MemcachePlus = require('memcache-plus');
const express = require('express')

const app = express()
const cacheTimeSecs = 15
//const numberOfCompanies = 20
const allCompanies = ['Toyota', 'Honda', 'Chevrolet', 'Ford','Mercedes-Benz','Jeep','BMW','Porsche','Subaru','Nissan','Cadillac',
'Volkswagen','Lexus','Audi','Ferrari','Volvo','Jaguar','GMC','Buick','Acura','Bentley'];

// -------------------------------------------------------
// Command-line options
// -------------------------------------------------------

let options = optionparser
	.storeOptionsAsProperties(true)
	// Web server
	.option('--port <port>', "Web server port", 3000)
	// Kafka options
	.option('--kafka-broker <host:port>', "Kafka bootstrap host:port", "my-cluster-kafka-bootstrap:9092")
	.option('--kafka-topic-tracking <topic>', "Kafka topic to tracking data send to", "tracking-data")
	.option('--kafka-client-id < id > ', "Kafka client ID", "tracker-" + Math.floor(Math.random() * 100000))
	// Memcached options
	.option('--memcached-hostname <hostname>', 'Memcached hostname (may resolve to multiple IPs)', 'my-memcached-service')
	.option('--memcached-port <port>', 'Memcached port', 11211)
	.option('--memcached-update-interval <ms>', 'Interval to query DNS for memcached IPs', 5000)
	// Database options
	.option('--mysql-host <host>', 'MySQL host', 'my-app-mysql-service')
	.option('--mysql-port <port>', 'MySQL port', 33060)
	.option('--mysql-schema <db>', 'MySQL Schema/database', 'ranking')
	.option('--mysql-username <username>', 'MySQL username', 'root')
	.option('--mysql-password <password>', 'MySQL password', 'mysecretpw')
	// Misc
	.addHelpCommand()
	.parse()
	.opts()

// -------------------------------------------------------
// Database Configuration
// -------------------------------------------------------

const dbConfig = {
	host: options.mysqlHost,
	port: options.mysqlPort,
	user: options.mysqlUsername,
	password: options.mysqlPassword,
	schema: options.mysqlSchema
};

async function executeQuery(query, data) {
	let session = await mysqlx.getSession(dbConfig);
	return await session.sql(query, data).bind(data).execute()
}

// -------------------------------------------------------
// Memcache Configuration
// -------------------------------------------------------

//Connect to the memcached instances
let memcached = null
let memcachedServers = []

async function getMemcachedServersFromDns() {
	try {
		// Query all IP addresses for this hostname
		let queryResult = await dns.lookup(options.memcachedHostname, { all: true })

		// Create IP:Port mappings
		let servers = queryResult.map(el => el.address + ":" + options.memcachedPort)

		// Check if the list of servers has changed
		// and only create a new object if the server list has changed
		if (memcachedServers.sort().toString() !== servers.sort().toString()) {
			console.log("Updated memcached server list to ", servers)
			memcachedServers = servers

			//Disconnect an existing client
			if (memcached)
				await memcached.disconnect()

			memcached = new MemcachePlus(memcachedServers);
		}
	} catch (e) {
		console.log("Unable to get memcache servers", e)
	}
}

//Initially try to connect to the memcached servers, then each 5s update the list
getMemcachedServersFromDns()
setInterval(() => getMemcachedServersFromDns(), options.memcachedUpdateInterval)

//Get data from cache if a cache exists yet
async function getFromCache(key) {
	if (!memcached) {
		console.log(`No memcached instance available, memcachedServers = ${memcachedServers}`)
		return null;
	}
	return await memcached.get(key);
}

// -------------------------------------------------------
// Kafka Configuration
// -------------------------------------------------------

// Kafka connection
const kafka = new Kafka({
	clientId: options.kafkaClientId,
	brokers: [options.kafkaBroker],
	retry: {
		retries: 0
	}
})

const producer = kafka.producer()
// End

// Send tracking message to Kafka
async function sendTrackingMessage(data) {
	//Ensure the producer is connected
	await producer.connect()

	//Send message
	await producer.send({
		topic: options.kafkaTopicTracking,
		messages: [
			{ value: JSON.stringify(data) }
		]
	})
}
// End

// -------------------------------------------------------
// HTML helper to send a response to the client
// -------------------------------------------------------

function sendResponse(res, html, cachedResult) {
	res.send(`<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Big Data Use-Case Demo</title>
			<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/mini.css/3.0.1/mini-default.min.css">
			<script>
				function fetchRandomCompanies() {
					const maxRepitition = Math.floor(Math.random() * 200)
					document.getElementById("out").innerText = "Fetching " + maxRepitition + " random companies, see console output"
					const allCompanies = ${JSON.stringify(allCompanies)}
					for(var i = 0; i < maxRepitition; ++i) {
						const nameId = Math.floor(Math.random()*allCompanies.length)
						console.log("Fetching name id " + nameId)
						fetch("/companies/" + allCompanies[nameId], {cache: 'no-cache'})
					}
				}
			</script>
		</head>
		<body>
		<div id="scoped-content">
			<style type="text/css" scoped>
			#scoped-content {
				display: flex;
				flex-direction: column;
			}
			body {
				color: #6864e2;
			}
			a:hover {
				color: #6864e2;
			}
			ul { //Server Infos
				color: #2f1264;
			}
			</style>
			<h1>Demo Car Company Ranking</h1>
			<p>  
				<a href="javascript: fetchRandomCompanies();">Randomly fetch some companies</a>
				<span id="out"></span>
			</p>
			${html}
			<hr>
			<div class="footer">
			<style type="text/css" scoped>
			.footer {
				margin: 20px;
				left: 2rem;
			}
			</style>
			<h2>Information about the generated page</h4>
			<ul>
				<li>Server: ${os.hostname()}</li>
				<li>Date: ${new Date()}</li>
				<li>Using ${memcachedServers.length} memcached Servers: ${memcachedServers}</li>
				<li>Cached result: ${cachedResult}</li>
			</ul>
			</div>
		</body>
	</html>
	`)
}

// -------------------------------------------------------
// Start page
// -------------------------------------------------------

// Get list of names (from cache or db)
async function getCompanies() {
	const key = 'companies'
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, cachedata = ${cachedata}`)
		return { result: cachedata, cached: true }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)
		let executeResult = await executeQuery("SELECT name FROM companies", [])
		let data = executeResult.fetchAll()
		if (data) {
			let result = data.map(row => row[0])
			console.log(`Got result=${result}, storing in cache`)
			if (memcached)
				await memcached.set(key, result, cacheTimeSecs);
			return { result, cached: false }
		} else {
			throw "No companies data found"
		}
	}
}

// Get popular names (from db only)
async function getRanking(maxCount) {
	const query = "SELECT name, count FROM ranking ORDER BY count DESC LIMIT ?"
	return (await executeQuery(query, [maxCount]))
		.fetchAll()
		.map(row => ({ name: row[0], count: row[1] }))
}

// Return HTML for start page
app.get("/", (req, res) => {
	const topX = 5;
	Promise.all([getCompanies(), getRanking(topX)]).then(values => {
		const companies = values[0]
		const ranking = values[1]

		const companiesHtml = companies.result
			.map(m => `<a href='companies/${m}'>${m}</a>`)
			.join(" ")

		const rankingHtml = ranking
			.map(pop => `<li> <a style="color:white;" href='companies/${pop.name}'>${pop.name}</a> (${pop.count} views) </li>`)
			.join("\n")

		const html = `
			<div class="ranked">
			<style type="text/css" scoped>
			.ranked ol {
				border-radius: 7px;
				margin: 20px;
				width: 350px;
				padding: 20px;
				list-style: none;
				counter-reset: item;
			}
			.ranked li {
				color: white;
				background-color: #6864e2;
				margin: 30px;
				border-radius: 7px;
				padding: 3px;
				counter-increment: item;
				box-shadow: 10px 5px #6864e26b;
			}
			.ranked li:before {
				content: counter(item);
				padding: 15px;
				border-radius: 100px;
				background-color: #6864e2;
				margin: 10px;
				font-weight: bold;
			}
			</style>
			<h2>Top ${topX} ranked car companies </h2>		
			<p>
				<ol style="margin-left: 2em; color: white;"> ${rankingHtml} </ol>  
			</p>
			</div>

			<div class="allCompanies">
			<style type="text/css" scoped>
			.allCompanies a:link{
				color: white;
				background-color: #6864e2;
				border-radius: 7px;
				margin: 7px;
				line-height: 3;
				padding: 9px;
				box-shadow: 5px 5px #6864e23d;
			}
			.allCompanies a:hover{
				color: white;
				text-decoration: none;
			}
			.allCompanies a:visited{
				color: white;
			}
			</style>
			<h2>All car companies</h2>
			<p> ${companiesHtml} </p>
			</div>
			`
			
		sendResponse(res, html, companies.cached)
	})
})

// -------------------------------------------------------
// Get a specific name (from cache or DB)
// -------------------------------------------------------

async function getCompany(name) {
	const query = "SELECT name, origin, segment, logo_link FROM companies WHERE name = ?"
	const key = 'name_' + name
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, cachedata = ${cachedata}`)
		return { ...cachedata, cached: true }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)

		let data = (await executeQuery(query, [name])).fetchOne()
		if (data) {
			let result = { name: data[0], origin: data[1], segment: data[2], logo_link: data[3] }
			console.log(`Got result=${result}, storing in cache`)
			if (memcached)
				await memcached.set(key, result, cacheTimeSecs);
			return { ...result, cached: false }
		} else {
			throw "No data found for this company"
		}
	}
}

app.get("/companies/:name", (req, res) => {
	let name = req.params["name"]

	// Send the tracking message to Kafka
	sendTrackingMessage({
		name,
		timestamp: Math.floor(new Date() / 1000)
	}).then(() => console.log("Sent to kafka"))
		.catch(e => console.log("Error sending to kafka", e))

	// Send reply to browser
	getCompany(name).then(data => {
		sendResponse(res, `
		<div class="singleCar">
		<style type="text/css" scoped>
		.background{
			background-color: #6864e2;
			color: white;
			width: 500px;
			border-radius: 100px;
			box-shadow: 10px 5px #6864e26b;
		}
		.background img{
			display: block;
			margin-left: auto;
			margin-right: auto;
		}
		.singleCar p, .singleCar h2 {
			text-align: center;
		}
		</style>

		<h2 style="width: 500px;">${data.name}</h2>
		<p class="background"> The origin is: ${data.origin}</p>
		<p class="background"> The Category is: ${data.segment}</p>
		<p class="background" > <img src="${data.logo_link}"></p>
		</div>`, data.cached)
		
	}).catch(err => {
		sendResponse(res, `<h2>Error</h2><p>${err}</p>`, false)
	})
});

// -------------------------------------------------------
// Main method
// -------------------------------------------------------

app.listen(options.port, function () {
	console.log("Node app is running at http://localhost:" + options.port)
});
