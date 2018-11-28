const mongodb = require('mongodb');

let db = null;

mongodb.connect('mongodb://localhost:27017', (err, client) => {
  if (err) return console.log(err)
  db = client.db('thaidb');

  db.collection('thaidb').aggregate([
    //{$unwind: "$categories.happening"},
    {$unwind: "$article.keywords"},
    //{$group:{_id:{keyword:"$categories.happening.external-factor", geo: "$categories.place.geo"},count:{$sum:1}}},
    //{$group:{_id:{keyword:"$categories.happening.external-factor", geo: "$categories.place.density"},count:{$sum:1}}},
    //{$group:{_id:{keyword:"$article.keywords", geo: "$categories.place.density"},count:{$sum:1}}},
    //{$group:{_id:{keyword:"$article.keywords", geo: "$categories.place.geo"},count:{$sum:1}}},
    {$group:{_id:{keyword:"$article.keywords", geo: "$categories.place.geo"},count:{$sum:1}}},
    {$sort:{count:-1}}]).toArray((err, result) => {
        result.forEach(record => {
            console.log(`${record._id.keyword}, ${record._id.geo}, ${record.count}`);
        });
    });
});