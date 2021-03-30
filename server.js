// This to load the variablies from (.env) file
require('dotenv').config();



// This to load the dependencies for the APP
const { request, response } = require("express");
const express = require("express");
const cors = require("cors");
const superagent = require('superagent');
const pg = require("pg");

// Set-up 
const PORT = process.env.PORT;
const app = express();
const Geo_Key = process.env.Geo_Key;
const weather_API_Key = process.env.weather_Key;
const park_API_Key = process.env.api_key;
app.use(cors());
const DataBase_URL = process.env.DataBase_URL;
const client = new pg.Client(DataBase_URL);


// This is the Routes to find the files and get data from them 
app.get('/location', getLocation);
app.get('/weather', takeWeather);
app.get('/parks', getParks);
app.use('*', handleError);


// Functions to request and response 


function getParks(request, response) {
    let requestParkCode = request.query.parkCode;

    let parkQuery = {
        api_key: park_API_Key,
        parkCode: requestParkCode,
        parklimit: 10,
        // q is based on the parks api website which should be a request to city term (search_query in NETWORK)
        q: request.query.search_query
    };

    const url = `https://developer.nps.gov/api/v1/parks`;

    superagent.get(url).query(parkQuery).then(allData => {

        let array = allData.body.data.map(eachPark => {
            return new Park(eachPark);
        })

        response.send(array);
    }).catch((error) => {
        console.log(error);
        response.status(500).send("Error in loading PARKS");
    });
}

// ------------------------------------------------



function takeWeather(request, response) {
    // these two lines must be according to the Query string parameter in the console (NETWORK)
    const selectedLat = request.query.latitude;
    const selectedLon = request.query.longitude;

    const weatherQuery = {
        key: weather_API_Key,
        lat: selectedLat,
        lon: selectedLon,
        days: 8
    }

    const url = `http://api.weatherbit.io/v2.0/forecast/daily`

    superagent.get(url).query(weatherQuery).then(allData => {

        let array = allData.body.data.map(eachDay => {
            return new WeatherDataToFit(eachDay);
        })

        response.send(array)

    }).catch((error) => {
        response.status(500).send("Error in loading WEATHER")
    })

}


// ---------------------------

function toAddAndRenderFromDB(city, display_name, lat, lon) {

    const safeValues = [city, display_name, lat, lon];
    const sqlQuery = `INSERT INTO locations ( city, display_name, lat, lon ) VALUES( $1, $2, $3, $4 );`
        // const sqlQueryToMatchTheCity = `SELECT * FROM locations WHERE city like ${city};`;
    const sqlQueryToRenderAll = `SELECT * FROM locations;`

    client.query(sqlQueryToRenderAll).then(result => {
        if (result.rows.includes(city)) {

            const eachLocation = new LocationDataToFit(result.rows, city);
            response.status(200).send(eachLocation);

        } else {
            client.query(sqlQuery, safeValues).then(result => {
                response.status(200).send(result.rows);
            })
        }

    }).catch(error => {
        console.log(error);
        response.status(500).send("ERROR!");
    });
}



// -------------------------------------------------------------

function getLocation(request, response) {
    const { city, display_name, lat, lon } = request.query
    const url = `https://eu1.locationiq.com/v1/search.php`;

    const geoQuery = {
        key: Geo_Key,
        city: city,
        format: 'json'
    };

    if (!city) {
        response.status(404).send("City not found");
    };

    superagent.get(url).query(geoQuery).then(data => {
        toAddAndRenderFromDB(`${city}`, `${data.body[0].display_name}`, data.body[0].lat, data.body[0].lon);
    });

}


// ---------------------------------

function handleError(response) {
    response.status(500).send("Sorry, something went wrong")
}

// ------------------------------


//  Constructor functions to fit the data with the frontEnd
function LocationDataToFit(data, searchQuery) {
    this.formatted_query = data.display_name;
    this.latitude = data.lat;
    this.longitude = data.lon;
    this.city = searchQuery;
}

function WeatherDataToFit(day) {
    this.forecast = day.weather.description;
    this.time = day.datetime;

}

function Park(park) {
    this.name = park.fullName;
    this.fee = park.entranceFees[0].cost;
    this.address = `${park.addresses[0].city}, ${park.addresses[0].line1}, ${park.addresses[0].stateCode}, ${park.addresses[0].postalCode}`
    this.description = park.description;
    this.url = park.url
}


//  This to connect to the DB then listen to the port when you run it !
client.connect().then(() => {

    app.listen(PORT, () => {
        console.log('server = ' + PORT)
        console.log("Connected to database:", client.connectionParameters.database)
    });
})