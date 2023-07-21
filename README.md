# NPS - USA nearby places service
Simple service that returns nearby places for USA cities.


* Uses Apify to host and run the service, but it should be easily ported to any platform allowing Node.js projects.

* Uses the Apify's free mailer actor (` https://apify.com/apify/send-mail `) to optionally send the results to a given address.

* Uses a reverse-engineered FLIPKEY service which queries places from Tripadvisor itself.

* Uses a database of USA cities from ` https://simplemaps.com/data/us-cities ` to get geolocation details from.

Combines the previous features in a simple HTML form to query and browse results.


Usage
-----

Build + run, and point your browser to ` http://localhost:4321 ` (if running locally) or the URL the actor shows in the log. E.g., something like ` https://h12jc3izjdpp.runs.apify.net/ `.


Dependencies
------------

* [express](https://github.com/expressjs/express)
<br>For running a web server.
<br>`npm i express`

* [node-fetch](https://github.com/node-fetch/node-fetch)
<br>For requesting HTTP resources.
<br>`npm i node-fetch`

* [request-ip](https://github.com/pbojinov/request-ip)
<br>For getting the client's IP address (running as middleware for express).
<br>`npm i request-ip`