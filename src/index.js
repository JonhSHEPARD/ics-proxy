import fs from 'fs'
import express from 'express'
import axios from 'axios'
import ICAL from 'ical.js'
import {parseCalendar} from "./calendar.js";
import {updateFilteredCalendar} from "./update-calendar.js";
import {mergeCalendars} from "./merge-calendars.js";

const configFile = 'config.json';

function loadConfig() {
    const config = JSON.parse(fs.readFileSync(configFile, {encoding: 'utf8'}));
    const calendars = {};
    for (let calendarName in config) {
        console.log('Loading calendar: ', calendarName);
        calendars[calendarName] = parseCalendar(calendarName, config[calendarName]);

        console.log('Loaded calendar: ', calendarName);
        if(calendars[calendarName].type === 'filtered') {
            console.log(`\tHas ${calendars[calendarName].rules.length} rules.`);
        } else {
            console.log(`\tHas ${calendars[calendarName].urls.length} urls.`);
        }
    }
    return calendars;
}

let config = loadConfig();

// watch for changes in config file
fs.watchFile(configFile, (curr, prev) => {
    console.log('Config file changed. Reloading...');
    try {
        config = loadConfig();
    } catch (err) {
        console.log('Could not reload config file. Error: ', err);
    }
});

const app = express()
const port = process.env.PORT || 3000

app.get('/', (req, res) => {
    res.send('Hello, you should not be here :)');
});

app.get('/:calendarName.ics', async (req, res, handleErr) => {
    const calendarName = req.params.calendarName;

    if (!config[calendarName]) {
        res.status(404).json('Not found.');
        return;
    }

    const calendarConf = config[calendarName];

    // log request
    console.log(`Request for calendar ${calendarName} from ${req.ip} at ${new Date().toISOString()}`);

    switch (calendarConf.type) {
        case 'filtered':
            await updateFilteredCalendar(calendarConf, res, handleErr);
            break;
        case 'merged':
            await mergeCalendars(calendarConf, res, handleErr);
            break;
        default:
            res.status(404).json('Not found.');
            break;
    }
});

app.use((err, req, res, next) => {
    console.log('Catched error: ', err)
    res.status(500).send(err.message);
});

app.listen(port, () => {
    console.log(`Calendar server listening at http://localhost:${port}`)
});
