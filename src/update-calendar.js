import axios from "axios";
import ICAL from "ical.js";

export async function updateFilteredCalendar(calendarConf, res, handleErr) {
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
            event[1] = eventData;
            newEvents.push(event);
        }
    }

    ical[2] = newEvents
    const comp = new ICAL.Component(ical);

    res.setHeader('content-type', 'text/calendar');
    res.send(comp.toString());
}