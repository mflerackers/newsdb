const importCsv = require('./importCsv.js');
const importDb = require('./importDb.js');
const fs = require('fs');

const list = JSON.parse(fs.readFileSync("fileList.json", "utf8"));
for (path of list) {
    const json = importCsv(path);
    importDb(json);
}

/*function sortMapByValue(map) {
    let list = [];
    for (let key in map) {
        list.push([key, map[key]]);
    }
    list.sort((a,b) => b[1]-a[1]);
    return list;
}*/

/*let r = [
    {
        id:1,
        article:{
            topics:[1,2,3]
        }
    },
    {
        id:2, 
        article:{
            topics:[3,4,5]
        }
    }
]

r=db.unwind(r, "article.topics");
console.log(r);
r=db.sortByCount(r, "article.topics");
console.log(r);

r=db.unwind(json, "categories.topics");
//console.log(r);
r=db.sortByCount(r, ["categories.topics", "bibliography.size.article"]);
console.log(r);*/

/*r=db.unwind(json, "categories.topics");
//console.log(r);
r=db.sortByCount(r, ["bibliography.page", "categories.topics"]);
console.log(r);*/

/*r=db.unwind(json, "categories.topics");
//console.log(r);
r=db.sortByCount(r, ["categories.place.geo", "categories.topics"]);
r.sort((a,b) => {
    let a0 = a[0].toLowerCase().split(",")[0];
    let b0 = b[0].toLowerCase().split(",")[0];
    return a0.localeCompare(b0) ? a0.localeCompare(b0) : b[2]-a[2];
});
r.forEach(record => {
    record[0] = record[0].split(",")[0];
    console.log(record.join(","));
});*/

/*r=db.unwind(json, "categories.happening");
//console.log(JSON.stringify(r, null, 4));
r=db.sortByCount(r, ["categories.place.geo", "categories.happening.external-factor"]);
console.log(r);*/