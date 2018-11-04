const importCsv = require('./importCsv.js');
const db = require('./db.js');

const json = importCsv("./data/merged.csv");

let r = [
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
console.log(r);