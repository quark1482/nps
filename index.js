import express   from 'express';
import fetch     from 'node-fetch';
import requestIp from 'request-ip';
import * as fs   from 'fs/promises';

const ex = express();
let usCities = [];
main();

async function main() {
    let port = 4321;
    let url  = `http://localhost:${port}`;
    if (Object.hasOwn(process.env, 'APIFY_IS_AT_HOME')) {
        port = process.env.APIFY_CONTAINER_PORT;
        url  = process.env.APIFY_CONTAINER_URL;
    }
    try {
        let r;
        r = await getIP();
        if (!r.status) {
            console.error(`getIP() failed: ${r.message}`);
            return;
        }
        let ip = r.ip;
        r = await loadUSCities();
        if (!r.status) {
            console.error(`loadUSCities() failed: ${r.message}`);
            return;
        }
        usCities = r.uscities.sort(
            function(a, b) {
                if (a.city === b.city) {
                    return a.state_name.localeCompare(b.state_name);
                } else {
                    return a.city.localeCompare(b.city);
                }
            }
        );
        ex.set(
            'query parser',
            'simple'
        );
        ex.use(express.urlencoded({ extended: true }))
        ex.use(requestIp.mw());
        ex.use('/styles', express.static('styles'));
        ex.get(
            '/',
            serveGetRoot
        );
        ex.get(
            '/locsearch',
            serveGetLocationSearch
        );
        ex.post(
            '/',
            servePostRoot
        );
        ex.listen(
            port,
            function() {
                console.log('Server started');
                console.log(`Server ip: ${ip}`);
                console.log(`URL: ${url}`);
                console.log(`port: ${port}`);
            }
        );
    }
    catch (err) {
        console.error(`main() failed: ${err.message}`);
    }
}

function getCityAndState(l) {
    let ret = {
        city: '',
        state: ''
    };
    let a = l.split(',', 2);
    a.forEach(
        function(v, i) {
            a[i] = v.trim();
        }
    );
    ret.city = a[0].toLowerCase();
    ret.state = '';
    if (2 == a.length) {
        ret.state = a[1].toLowerCase();
    }
    return ret;
}

async function getHTTPResponse(url, method = 'GET', headers = {}, body = '') {
    method = method.toUpperCase();
    if ('GET' === method || 'HEAD' === method)
        return fetch(url, { method, headers });
    else
        return fetch(url, { method, headers, body });
}

async function getIP() {
    let ret = {
        status:  false,
        message: '',
        ip:      ''    
    };
    try {
        const res = await getHTTPResponse('https://api.bigdatacloud.net/data/client-info');
        if (200 != res.status) {
            ret.message = `Unexpected response code: ${res.status}`;
        } else if (-1 == res.headers.get('Content-Type').indexOf('application/json')) {
            ret.message = `Unexpected content type: ${res.headers.get('Content-Type')}`;
        } else {
            const jsn = await res.json();
            ret.ip = jsn.ipString;
            ret.status = true;
        }
    }
    catch (err) {
        ret.message = err.message;
    }
    return ret;
}

async function getNearbyPlaces(lat, lng, zoom) {
    let ret = {
        status:  false,
        message: '',
        nearby:  []        
    };
    try {
        const fkurl = 'https://www.flipkey.com';
        const places = 'restaurants=true&attractions=true';
        const res = await getHTTPResponse(`${fkurl}/content/map_poi?lat=${lat}&lng=${lng}&zoom=${zoom}&${places}&limit=25`);
        if (200 != res.status) {
            ret.message = `Unexpected response code: ${res.status}`;
        } else if (-1 == res.headers.get('Content-Type').indexOf('application/json')) {
            ret.message = `Unexpected content type: ${res.headers.get('Content-Type')}`;
        } else {
            const jsn = await res.json();
            for (const elm in jsn) {
                if (Array.isArray(jsn[elm])) {
                    for (const p of jsn[elm]) {
                        let place = {};
                        if (p.name) {
                            place.name = p.name;
                        }
                        if (p.category) {
                            if (p.category.name) {
                                place.category = p.category.name;
                                place.subCategories = [];
                                if (Array.isArray(p.subcategory)) {
                                    for (const c of p.subcategory) {
                                        if (c.name) {
                                            place.subCategories.push(c.name);
                                        }
                                    }
                                }
                            }
                        }
                        let types=[];
                        if (Array.isArray(p.cuisine)) {
                            types = p.cuisine;
                        } else if (Array.isArray(p.attraction_types)) {
                            types = p.attraction_types;
                        }
                        if (types.length) {
                            place.types = [];
                            for (const t of types) {
                                if (t.name) {
                                    place.types.push(t.name);
                                }
                            }
                        }
                        if (Array.isArray(p.groups)) {
                            if (p.groups.length) {
                                place.groups = [];
                                for (const g of p.groups) {
                                    if (g.name) {
                                        place.groups.push(g.name);
                                    }
                                }
                            }
                        }
                        if (p.address_obj) {
                            if (p.address_obj.address_string) {
                                place.address = p.address_obj.address_string;
                            }
                        }
                        if (p.distance) {
                            place.distance = p.distance;
                        }
                        if (p.rating) {
                            place.rating = p.rating;
                        }
                        if (p.ranking_data) {
                            if (p.ranking_data.ranking_string) {
                                place.ranking = p.ranking_data.ranking_string;
                            }
                        }
                        if (p.price_level) {
                            place.priceLevel = p.price_level;
                        }
                        if (place.name.length && place.category.length) {
                            ret.nearby.push(place);
                        }
                    }
                }
            }
            ret.status = true;
        }
    }
    catch (err) {
        ret.message = err.message;
    }
    return ret;
}

async function loadUSCities() {
    let ret = {
        status:   false,
        message:  '',
        uscities: []
    };
    const jsonURL = 'https://api.npoint.io/e53b0fd5a237603e0f09';
    try {
        const res = await fetch(jsonURL);
        if (200 != res.status) {
            ret.message = `Unexpected response code: ${res.status}`;
        } else if (-1 == res.headers.get('content-type').indexOf('application/json')) {
            ret.message = `Unexpected content type: ${res.headers.get('content-type')}`;
        } else {
            let cr = await res.json();
            if (!Array.isArray(cr)) {
                ret.message = `Unexpected content: downloaded JSON is not an array`;
            } else if (!cr.length) {
                ret.message = 'Unexpected content: downloaded array is empty';
            } else {
                ret.uscities = cr;
                ret.status = true;
            }
        }
    } catch (err) {
        ret.message = err.message;
    }
    return ret;
}

async function makeResults(location, nearby, email) {
    let ret;
    if (nearby.length) {
        let tbl = '';
        tbl += '<table>';
        tbl += '<caption><h2>Nearby places<h2></caption>';
        tbl += '<tr>';
        tbl += `<th>Place</th>`;
        tbl += `<th>Category</th>`;
        tbl += `<th>Address</th>`;
        tbl += `<th>Distance</th>`;
        tbl += `<th>Rating</th>`;
        tbl += '</tr>';
        for (const n of nearby) {
            tbl += '<tr>';
            tbl += `<td>${n.name}</td>`;
            tbl += `<td>${n.category}</td>`;
            tbl += `<td>${n.address}</td>`;
            tbl += `<td>${n.distance}</td>`;
            tbl += `<td>${n.rating}</td>`;
            tbl += '</tr>';
        }
        tbl += '</table>';
        if (email.length) {
            let r = await sendMail(email, `Your requested nearby places for ${location}`, tbl);
            if (r.status) {
                ret = `<p>Results will be sent to ${email}</p>`;
            } else {
                ret = `<p>sendMail() failed ${r.message}</p>`;
            }
        } else {
            ret = tbl;
        }
    } else {
        ret = '<p>No results found</p>';
    }
    return ret;
}

async function makeRoot(prevResults = '') {
    let html = await fs.readFile('./index.html', 'utf-8');
    html = html.replace('<!-- prevResuts -->', prevResults);
    return html;
}

async function sendMail(...args) {
    let ret = {
        status:  false,
        message: ''  
    };
    try {
        const apurl = 'https://api.apify.com';
        const [to, subject, html] = args;
        const body = { to, subject, html };
        const res = await getHTTPResponse(
            `${apurl}/v2/acts/apify~send-mail/runs?token=${process.env.APIFY_TOKEN}`,
            'POST',
            { 'Content-Type':'application/json' },
            JSON.stringify(body)
        );
        if (201 != res.status) {
            ret.message = `Unexpected response code: ${res.status}`;
        } else if (-1 == res.headers.get('Content-Type').indexOf('application/json')) {
            ret.message = `Unexpected content type: ${res.headers.get('Content-Type')}`;
        } else {
            console.log('e-mail sent');
            ret.status = true;
        }
    }
    catch (err) {
        ret.message = err.message;
    }
    return ret;
}

async function serveGetLocationSearch(req, res) {
    try {
        let search = [];
        if (req.query.l) {
            search = usCities.filter(
                function(obj) {
                    const r = getCityAndState(req.query.l);
                    if(r.city) {
                        if (r.state) {
                            return obj.city.toLowerCase() === r.city && obj.state_name.toLowerCase().startsWith(r.state);
                        } else {
                            return obj.city.toLowerCase().startsWith(r.city);
                        }
                    } else if (r.state) {
                        return obj.state_name.toLowerCase().startsWith(r.state);
                    } else {
                        return false;
                    }
                }
            );
        }
        res.set('Content-Type', 'application/json');
        res.send(JSON.stringify(search));
    }
    catch(err) {
        console.error(`serveGetLocationSearch() failed: ${err.message}`);
        res.status(500);
        res.send('Internal Server Error');
    }
}

async function serveGetRoot(req, res) {
    try {
        console.log('\nRequest arrived');
        console.log(`Client ip: ${req.clientIp}`);
        console.log(`Client user-agent: ${req.headers['user-agent']}`);
        res.set('Content-Type', 'text/html'); 
        res.send(await makeRoot());
    }
    catch (err) {
        console.error(`serveGetRoot() failed: ${err.message}`);
        res.status(500);
        res.send('Internal Server Error');
    }
}

async function servePostRoot(req, res) {
    try {
        console.log(req.body);
        if (req.body.location) {
            const l = usCities.find(
                function (obj) {
                    return obj.id === Number(req.body.id);
                }
            );
            if (l) {
                console.log(`lat: ${l.lat}, lng: ${l.lng}, zoom: ${req.body.zoom}`);
                const n = await getNearbyPlaces(l.lat, l.lng, req.body.zoom);
                if (n.status) {
                    const p = n.nearby.sort(
                        function(a, b) {
                            let da = Number(a.distance);
                            let db = Number(b.distance);
                            return da < db ? -1 : da > db ? 1 : 0;
                        }
                    );
                    res.send(await makeRoot(await makeResults(req.body.location, p, req.body.email)));
                } else {
                    console.error(`getNearbyPlaces() failed: ${n.message}`);
                    res.status(500);
                    res.send('Internal Server Error');
                }
                return;
            }
        }
        res.status(400);
        res.send('Bad Request');
    }
    catch (err) {
        console.error(`servePostRoot() failed: ${err.message}`);
        res.status(500);
        res.send('Internal Server Error');
    }
}