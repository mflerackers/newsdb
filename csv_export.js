const stringify = require('csv-stringify')
const jsep = require('jsep')
const calcExpression = require('./expression').calcExpression;

const cache = {};
function expressionFromFormula(formula) {
    let expression = cache[formula];
    if (!expression) {
        expression = jsep(formula);
        cache[formula] = expression;
    }
    return expression;
}

module.exports = function exportCsv(template, data, res, _env) {
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
    data.forEach(env=>{
        env = {...env, ..._env}
        stringifier.write(Object.values(template).map(formula=>{
            let expression = expressionFromFormula(formula);
            return calcExpression(env, expression) || "NA";
        }));
    });
    stringifier.end();
}

