function sortMapByValue(map) {
    let list = [];
    for (let key in map) {
        list.push([key, map[key]]);
    }
    list.sort((a,b) => b[1]-a[1]);
    return list;
}

function clone(record) {
    return JSON.parse(JSON.stringify(record));
}

function getObjectAtPath(record, path) {
    if (!Array.isArray(path)) {
        path = path.split(".");
    }
    let object = record;
    for (key of path) {
        let next = object[key];
        if (!next)
            return null;
        object = next;
    }
    return object;
}

function setObjectAtPath(record, path, value) {
    if (!Array.isArray(path)) {
        path = path.split(".");
    }
    let object = record;
    for (key of path.slice(0,-1)) {
        let next = object[key];
        if (!next)
            return null;
        object = next;
    }
    object[path[path.length-1]] = value;
    return record;
}

function sortByCount(records, fields) {
    let count = {};
    if (Array.isArray(fields) && fields.length > 1) {
        for (let record of records) {
            let values = fields.map(field => getObjectAtPath(record, field));
            count[values] = (count[values] || 0) + 1;
        }
    }
    else {
        let key = Array.isArray(fields) ? fields[0] : fields;
        for (let record of records) {
            let value = getObjectAtPath(record, key);
            count[value] = (count[value] || 0) + 1;
        }
    }
    newRecords = [];
    for (let key in count) {
        newRecords.push({"_id":key, "count":count[key]});
    }
    newRecords.sort((a,b) => b.count-a.count);
    return newRecords;
}

function unwind(records, path) {
    if (!Array.isArray(path)) {
        path = path.split(".");
    }
    let newRecords = [];
    records.forEach(record => {
        let object = getObjectAtPath(record, path);
        if (Array.isArray(object)) {
            object.forEach(value => {
                newRecords.push(setObjectAtPath(clone(record), path, value));
            });
        }
        else {
            newRecords.push(record);
        }
    });
    return newRecords;
}

module.exports = {
    unwind:unwind,
    sortByCount:sortByCount
};