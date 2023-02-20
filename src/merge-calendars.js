import axios from "axios";
import ICAL from "ical.js";

export async function mergeCalendars(calendarConf, res, handleErr) {
    let ics = null;
    let events = [];

    for (let calendar of calendarConf.urls) {
        let icsData;
        try {
            icsData = await axios.get(calendar.url);
        } catch (err) {
            handleErr(err);
            return;
        }
        if (icsData.status !== 200) {
            res.status(500).send(`Could not get original ics data. Got response code ${icsData.status} and body: ${icsData.data}`);
            return;
        }
        let ical = ICAL.parse(icsData.data);

        if (ics === null) {
            ics = ical;
        }

        if (calendar.private) {
            for (let event of ical[2]) {
                if (event[0] !== 'vevent') {
                    continue;
                }
                let eventData = event[1];
                console.log(eventData);
                event[1] = eventData;
                events.push(event);
            }
        } else {
            events.push(...ical[2]);
        }
    }

    ics[2] = events
    const comp = new ICAL.Component(ics);

    res.setHeader('content-type', 'text/calendar');
    res.send(comp.toString());
}
