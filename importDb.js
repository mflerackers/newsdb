let mongodb = require('mongodb');

module.exports = {};

module.exports = function(jsonList) {
    mongodb.connect("mongodb://localhost:27017", function(err, db) {
        if (err) throw err;
        console.log("Connected");
        var dbo = db.db("thaidb");
        for (let json of jsonList) {
            dbo.collection("thaidb").updateOne({id:json.id}, {$set:json}, { upsert: true }, function(err, res) {
                if (err) 
                    console.log(err);
                else
                    console.log(json.id + " document updated");
            });
        }
        db.close();
    });
};