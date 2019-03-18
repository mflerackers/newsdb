const stringify = require('csv-stringify')

function getNameIndex(nameIndex) {
    let start = nameIndex.indexOf("[");
    if (start == -1) return [nameIndex, null];
    let end = nameIndex.indexOf("]");
    return [nameIndex.slice(0, start), +nameIndex.slice(start+1, end)];
}

// This would look prettier if slice was used instead of an index
function lookUp(map, path, index=0) {
    if (!map) {
        return "NA";
    }

    let [name, i] = getNameIndex(path[index]);
    let object;
    if (i !== null) {
        let array = map[name];
        if (array && i < array.length) {
            object = array[i];
        }
    }
    else {
        object = map[name];
    }

    if (index == path.length-1) {
        return object || "NA";
    }
    else {
        return lookUp(object, path, index+1);
    }
}

module.exports = function exportCsv(template, data, res) {
    let csvRows = [];

    const stringifier = stringify({
        delimiter: ','
    });
    stringifier.on('readable', function(){
        let row;
        while(row = stringifier.read()){
            csvRows.push(row);
        }
    });
    stringifier.on('error', function(err){
        console.error(err.message);
    });
    stringifier.on('finish', function(){
        res.attachment(`export.csv`);
        res.status(200).send(csvRows.join(""));
    });

    stringifier.write(Object.keys(template));
    data.forEach(d=>{
        stringifier.write(Object.values(template).map(path=>{
            return lookUp(d, path.split("."));
        }));
    });
    stringifier.end();
}

