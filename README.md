# ics-proxy

Creates a proxy using an ics as input, which filters the events based on the filters specified in the config file and
returns the filtered ics file.

## Setup

The `config.json` file configures all available calandars and their filters.
You can create it by copying the `config.example.json` file.

You can make two types of calendars :

- `filtered`: This calendar will filter the events based on the filters specified in the `rules` property.
- `merged`: This calendar will merge the events of the calendars specified in the `urls` property.

### The `filtered` calendar

The first property required for a `filtered` calendar is the `url` property, which specifies the url of the ics file to
use.
You can then make the filters using the `rules` property.
You can also decide what to do with the events that match the filters using the `operations` property.

The filters make it possible to create a compicated if statement.

The following json:

```json
{
  "test": {
    "type": "filtered",
    "url": "https://canvas.uva.nl/feeds/calendars/XXX.ics",
    "rules": [
      {
        "filter": {
          "key": "and",
          "left": {
            "key": "if",
            "left": "event.location",
            "operator": "regex",
            "right": "Zoom Online Meeting"
          },
          "right": {
            "key": "if",
            "left": "event.summary",
            "operator": "regex",
            "right": ".*college.*"
          }
        }
      }
    ],
    "operations": [
      [
        "remove"
      ]
    ]
  }
}
```

Will translate in the following if statement:

```javascript
if (event.location === "Zoom Online Meeting" && event.summary.match(/.*college.*/)) {
    // remove the event
}
```

#### Filters

The filters allows to select events based.

There is currently 3 types of filters, defined by their `key` property:

- `and`: This filter will select the event if the `left` and `right` filters are both true.
- `or`: This filter will select the event if either the `left` or the `right` filter is true.
- `if`: This filter will check if the value of the `left` property matches the `right` property using the `operator`
  property.

#### The `if` filter

The `if` filter has the following properties:

- `left` or `right`: The value to check, you can input two types of values:
    - A string matching `event.<property>`, where `<property>` is a property of the event, for example `event.location`.
      It will replace the string with the value of the property.
    - Anything else as a value, note that for some operators this value will be converted into another type, it must
      then be a valid value for that type.

- `operator`: The operator to use to check if the value matches the `right` property. The following operators are
  available:
    - `==`: Checks if the values are equal.
    - `!=`: Checks if the values are not equal.
    - `===`: Checks if the values are equal and of the same type.
    - `!==`: Checks if the values are not equal or not of the same type.
    - `>`: Checks if the left value is greater than the right value.
    - `<`: Checks if the left value is smaller than the right value.
    - `>=`: Checks if the left value is greater than or equal to the right value.
    - `<=`: Checks if the left value is smaller than or equal to the right value.
    - `contains`: Checks if the left value contains the right value.
    - `regex`: Checks if the left value matches the right value as a regular expression. **The right value must be a
      valid regular expression.**

You can also add the property `negate` with the value `true` to the `if` filter to negate the result of the filter.

#### Operations

The operations allow to modify the events that match the filters.

There is currently 3 types of operations, they are all represented by an array with the first element being the type of
the operation and the following elements being the arguments for the operation.

- `remove`: This operation will remove the event from the ics file, it takes no arguments.
- `edit`: This operation will edit the event, it takes two arguments:
    - The property to edit, for example `event.location`.
    - The new value for the property.
- `editRegex`: This operation will edit the event using a regular expression, it takes three arguments:
    - The property to edit, for example `event.location`.
    - The regular expression to use.
    - The new value for the property.

### The `merged` calendar

The first and only property required for a `merged` calendar is the `urls` property, which specifies the urls of the ics
files to use.

The urls should be objects with the following properties:

- `url`: The url of the ics file.
- `private`: A boolean indicating if the events of this calendar should be private or not.

Example :

```json
{
  "test": {
    "type": "merged",
    "urls": [
      {
        "url": "https://canvas.uva.nl/feeds/calendars/XXX.ics",
        "private": false
      },
      {
        "url": "https://canvas.uva.nl/feeds/calendars/XXX.ics",
        "private": true
      }
    ]
  }
}
```

## Running the server

Run the server using `npm start`, this will start the server on the port specified in the environment variable PORT or
3000 if this variable is not present.

### Running the server using docker

First you need to build the docker image using

```bash
docker build . -t ics-proxy:latest
```

Then you can run it using:

```bash
docker run -d -p 80:80 -v ./config.json:/app/config.json ics_filter:latest
```

If you wish to send it to an external server, withoud using a docker image repository, over SSH you can use this command
to do so:

```bash
docker save <image name> | ssh -C <ssh connection param> docker load
```

## Import the ics feed from this server.

Using your favourite calendar software, import the new file from the server by navigating to:
`domain.name/<calendarName>.ics`
Where <calendarName> is the key in `config.json` of the calendar you wish to retrieve.
