const allowedFilterKeys = ['and', 'or', 'if'];
const allowedIfOperators = {
    '==': function (eventData, left, right) {
        return left(eventData) == right(eventData);
    },
    '!=': function (eventData, left, right) {
        return left(eventData) != right(eventData);
    },
    "===": function (eventData, left, right) {
        return left(eventData) === right(eventData);
    },
    '!==': function (eventData, left, right) {
        return left(eventData) !== right(eventData);
    },
    '>': function (eventData, left, right) {
        return left(eventData) > right(eventData);
    },
    '>=': function (eventData, left, right) {
        return left(eventData) >= right(eventData);
    },
    '<': function (eventData, left, right) {
        return left(eventData) < right(eventData);
    },
    '<=': function (eventData, left, right) {
        return left(eventData) <= right(eventData);
    },
    'contains': function (eventData, left, right) {
        return left(eventData).indexOf(right(eventData)) !== -1;
    },
    'regex': function (eventData, left, right) {
        return new RegExp(right(eventData)).test(left(eventData));
    }
}
const allowedOperations = {
    'remove': {
        size: 1,
        fun: function (eventData) {
            return null;
        }
    },
    'edit': {
        size: 3,
        fun: function (eventData, args) {
            const key = args[0];
            const value = args[1];
            for (let i = 0; i < eventData.length; i++) {
                const dataLine = eventData[i];
                if (dataLine[0] === key) {
                    dataLine[3] = value;
                    break;
                }
            }
            return eventData;
        }
    },
    'editRegex': {
        size: 4,
        fun: function (eventData, args) {
            const key = args[0];
            const regex = new RegExp(args[1]);
            const value = args[2];
            for (let i = 0; i < eventData.length; i++) {
                const dataLine = eventData[i];
                if (dataLine[0] === key) {
                    dataLine[3] = dataLine[3].replace(regex, value);
                    break;
                }
            }
            return eventData;
        }
    }
}

function parseIfOperand(operand) {
    return function (eventData) {
        if (operand.startsWith('event.')) {
            const key = operand.substring('event.'.length);

            for (let i = 0; i < eventData.length; i++) {
                const dataLine = eventData[i];
                if (dataLine[0] === key && dataLine.length >= 4) {
                    return dataLine[3];
                }
            }
        } else {
            return operand;
        }
    }
}

function parseFilter(filter) {
    if (typeof filter !== 'object') {
        throw new Error(`Invalid filter: ${filter}`);
    }

    if (filter.hasOwnProperty('key')) {
        const key = filter.key;

        if (typeof key !== 'string' || allowedFilterKeys.indexOf(key) === -1) {
            throw new Error(`Invalid filter key: ${key}`);
        }

        if (key === 'if') {
            if (!filter.hasOwnProperty('left') || !filter.hasOwnProperty('operator') || !filter.hasOwnProperty('right')) {
                throw new Error(`Invalid filter: ${filter}`);
            }

            const left = filter.left;
            const operator = filter.operator.toLowerCase();
            const right = filter.right;

            if (typeof left !== 'string' || typeof operator !== 'string' || typeof right !== 'string') {
                throw new Error(`Invalid filter: ${filter}`);
            }

            if (!allowedIfOperators.hasOwnProperty(operator)) {
                throw new Error(`Invalid filter operator: ${operator}`);
            }

            // parse left and right
            const leftFun = parseIfOperand(left)
            const rightFun = parseIfOperand(right)

            const negate = filter.hasOwnProperty('negate') && filter.negate;

            const operatorFun = allowedIfOperators[operator];
            return function (eventData) {
                const value = operatorFun(eventData, leftFun, rightFun);
                return negate ? !value : value;
            }
        } else if (key === 'and' || key === 'or') {
            if (!filter.hasOwnProperty('left') || !filter.hasOwnProperty('right')) {
                throw new Error(`Invalid filter: ${filter}`);
            }

            const leftFun = parseFilter(filter.left);
            const rightFun = parseFilter(filter.right);

            if (key === 'and') {
                return function (eventData) {
                    return leftFun(eventData) && rightFun(eventData);
                }
            } else if (key === 'or') {
                return function (eventData) {
                    return leftFun(eventData) || rightFun(eventData);
                }
            }
        } else {
            throw new Error(`Invalid filter key: ${key}`);
        }
    }
}

function parseFilteredCalendar(calendarName, calendar) {
    // Calendar must have an url
    if (!calendar.hasOwnProperty('url')) {
        throw new Error(`Invalid calendar: ${calendarName} (missing url)`);
    }

    const url = calendar.url;

    // Check whether the url is valid with a regex
    if (typeof url !== 'string' || !url.match(/^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&\/=]*$/)) {
        throw new Error(`Invalid calendar: ${calendarName} (invalid url)`);
    }

    const checkedRules = [];

    // Check whether the calendar has a rules property
    if (calendar.hasOwnProperty('rules')) {
        // Rules must be a list of objects
        if (!Array.isArray(calendar.rules)) {
            throw new Error(`Invalid calendar: ${calendarName} (invalid rules)`);
        }

        const rules = calendar.rules;

        // Iterate over the rules
        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];

            // Rules must have a filter property
            if (!rule.hasOwnProperty('filter')) {
                throw new Error(`Invalid calendar: ${calendarName} (missing filter)`);
            }

            // Filters is an object, it must be either defined with a key property :
            // - filter group (and/or) containing and a left and a right property (filter)
            // - filter (if) containing a left, operator and right property
            const filter = rule.filter;

            if (typeof filter !== 'object') {
                throw new Error(`Invalid calendar: ${calendarName} (invalid filter)`);
            }

            // Parse the filter
            const filterFun = parseFilter(filter);

            // Rules must have an operation property
            if (!rule.hasOwnProperty('operations')) {
                throw new Error(`Invalid calendar: ${calendarName} (missing operations)`);
            }

            const operations = rule.operations;

            // Operation must be an array
            if (!Array.isArray(operations)) {
                throw new Error(`Invalid calendar: ${calendarName} (invalid operation)`);
            }

            let checkedOperations = [];

            // Iterate over the operations
            for (let j = 0; j < operations.length; j++) {
                const operation = operations[j];

                if(!Array.isArray(operation)) {
                    throw new Error(`Invalid calendar: ${calendarName} (invalid operation)`);
                }

                if(operation.length !== 1) {
                    throw new Error(`Invalid calendar: ${calendarName} (invalid operation)`);
                }

                const operationName = operation[0];
                if(typeof operationName !== 'string') {
                    throw new Error(`Invalid calendar: ${calendarName} (invalid operation)`);
                }

                if(!allowedOperations.hasOwnProperty(operationName)) {
                    throw new Error(`Invalid calendar: ${calendarName} (invalid operation)`);
                }

                const fun = allowedOperations[operationName].fun;

                const args = operation.slice(1);
                checkedOperations.push(function (eventData) {
                    return fun(eventData, args);
                });
            }

            checkedRules.push({
                filter: filterFun,
                operations: checkedOperations
            });
        }
    }

    return {
        type: 'filtered',
        name: calendarName,
        url: url,
        rules: checkedRules
    };
}

function parseMergedCalendar(calendarName, calendar) {
    // Calendar must have a urls property
    if (!calendar.hasOwnProperty('urls')) {
        throw new Error(`Invalid calendar: ${calendarName} (missing urls)`);
    }

    const urls = calendar.urls;

    // Urls must be an array
    if (!Array.isArray(urls)) {
        throw new Error(`Invalid calendar: ${calendarName} (invalid urls)`);
    }

    // Urls must not be empty
    if (urls.length === 0) {
        throw new Error(`Invalid calendar: ${calendarName} (empty urls)`);
    }

    let checkedUrls = [];

    // Each url must be an object with a url property and a private property
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];

        if (typeof url !== 'object') {
            throw new Error(`Invalid calendar: ${calendarName} (invalid url)`);
        }

        if (!url.hasOwnProperty('url')) {
            throw new Error(`Invalid calendar: ${calendarName} (missing url)`);
        }

        if (typeof url.url !== 'string') {
            throw new Error(`Invalid calendar: ${calendarName} (invalid url)`);
        }

        if (!url.hasOwnProperty('private')) {
            throw new Error(`Invalid calendar: ${calendarName} (missing private)`);
        }

        if (typeof url.private !== 'boolean') {
            throw new Error(`Invalid calendar: ${calendarName} (invalid private)`);
        }

        checkedUrls.push(url);
    }

    return {
        type: 'merged',
        name: calendarName,
        urls: checkedUrls
    }
}

export function parseCalendar(calendarName, calendar) {
    // Calendar name must be a string compliant with the following regex : [a-zA-Z0-9_\-]+
    if (typeof calendarName !== 'string' || !calendarName.match(/^[a-zA-Z0-9_\-]+$/)) {
        throw new Error(`Invalid calendar name: ${calendarName}`);
    }

    // Calendar must be an object
    if (typeof calendar !== 'object') {
        throw new Error(`Invalid calendar: ${calendarName}`);
    }

    // Calendar must have a type property
    if (!calendar.hasOwnProperty('type')) {
        throw new Error(`Invalid calendar: ${calendarName} (missing type)`);
    }

    const type = calendar.type;
    switch (type) {
        case 'filtered':
            return parseFilteredCalendar(calendarName, calendar);
        case 'merged':
            return parseMergedCalendar(calendarName, calendar);
    }

    throw new Error(`Invalid calendar: ${calendarName} (invalid type)`);
}
