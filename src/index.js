import fs from 'fs'
import express from 'express'
import axios from 'axios'
import ICAL from 'ical.js'
import {parseCalendar} from "./calendar.js";

const configFile = 'config.json';

function loadConfig() {
    const config = JSON.parse(fs.readFileSync(configFile, {encoding: 'utf8'}));
    const calendars = {};
    for (let calendarName in config) {
        console.log('Loading calendar: ', calendarName);
        calendars[calendarName] = parseCalendar(calendarName, config[calendarName]);

        console.log('Loaded calendar: ', calendarName);
        console.log(`\tHas ${calendars[calendarName].rules.length} rules.`);
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

    const calenderConf = config[calendarName];

    let ics;
    try {
        ics = await axios.get(calenderConf.url);
    } catch (err) {
        handleErr(err);
        return;
    }
    if (ics.status !== 200) {
        res.status(500).send(`Could not get original ics data. Got response code ${ics.status} and body: ${ics.data}`);
        return;
    }

    const ical = ICAL.parse(ics.data);
    const events = ical[2]

    const newEvents = []

    for (let event of events) {
        if(event[0] !== 'vevent') {
            newEvents.push(event);
            continue;
        }
        let eventData = event[1];

        // For each rules
        // If the rule matches the event
        // Apply every operation to the event
        // Add the event to the newEvents array
        for(let rule of calenderConf.rules) {
            const filter = rule.filter;
            if(!filter(eventData)) {
                newEvents.push(event);
                continue;
            }
            let remove = false;
            for(let operation of rule.operations) {
                const newEventData = operation(eventData);
                if(newEventData === null) {
                    remove = true;
                    break;
                }
                eventData = newEventData;
            }
            if(remove) {
                continue;
            }
            newEvents.push(event);
        }
    }

    ical[2] = newEvents
    const comp = new ICAL.Component(ical);

    res.setHeader('content-type', 'text/calendar');
    res.send(comp.toString());
});

app.use((err, req, res, next) => {
    console.log('Catched error: ', err)
    res.status(500).send(err.message);
});

app.listen(port, () => {
    console.log(`Calendar server listening at http://localhost:${port}`)
});
