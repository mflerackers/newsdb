const express = require('express')                              // Webserver
const formidable = require('formidable');                       // File upload
const fs = require('fs');                                       // File upload
const drive = require("./../drive");                            // Google drive

function getRouter(db, definitions, queryNames, fieldNames, process) {
    const exportCsv = require("./../csv_export");
    let router = express.Router()

    router.use(function (req, res, next) {
        if (!req.session || !req.session.userId) {
            return res.redirect(`/login?redirect=/db${encodeURIComponent(req.url)}`);
        }
        next();
    });

    router.get('/', function(req, res) {
        // Show cached list
        res.render('db.ejs', {
            name: req.params.name,
            articles: Object.values(definitions).filter(def=>def.users.includes(req.session.userId)),
            authenticated: true
        })
    })

    router.post('/:name/save', function(req, res) {
        if (!(req.params.name in definitions)) {
            res.status(403).send({success:false})
            return
        }
        let collection = definitions[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({success:false})
            return
        }

        // Get json
        let json = req.body
        // Update modified
        json.modified = new Date();

        // Insert or update
        db.collection(req.params.name).updateOne(
            {id:json.id}, 
            {
                $set:json, 
                $setOnInsert: { userId: req.session.userId }
            }, 
            {upsert: true}, function(err, result) {
            if (err) {
                res.status(200).send({success:false})
                console.log("error", err)
            }
            else {
                res.status(200).send({success:true})
                console.log(json.id + " document updated")
            }
        })
    })

    router.get('/:name/delete/:id', function(req, res) {
        if (!(req.params.name in definitions)) {
            res.status(403).send({success:false})
            return
        }
        let collection = definitions[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({success:false})
            return
        }

        // Delete
        db.collection(req.params.name).deleteOne({id:req.params.id, userId:req.session.userId}, function(err, result) {
            if (err) {
                console.log(err)
                return res.redirect(`/db/${req.params.name}/list`)
            }
            else {
                console.log(req.params.id + " document deleted")
                return res.redirect(`/db/${req.params.name}/list`)
            }
        });
    });

    router.get('/:name/new', function(req, res) {
        if (!(req.params.name in definitions)) {
            res.status(403).send({success:false})
            return
        }
        let collection = definitions[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({success:false})
            return
        }

        // Show empty form
        res.render('new.ejs', {
            name: req.params.name,
            data:{
                categories:{
                    place:{
                        geo:"thailand,bangkok,,"
                    }
                }
            },
            collection: collection,
            queryNames:queryNames,
            fieldNames:fieldNames,
            authenticated: true
        })
    })

    router.get('/:name/edit/:id', function(req, res) {
        if (!(req.params.name in definitions)) {
            res.status(403).send({success:false})
            return
        }
        let collection = definitions[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({success:false})
            return
        }

        // Show filled form
        db.collection(req.params.name).findOne({id: req.params.id}, (err, result) => {
            if (err) {
                res.status(404).send({success:false})
                return console.log(err);
            }
            res.render('new.ejs', {
                name: req.params.name,
                data:result,
                collection: collection,
                queryNames:queryNames,
                fieldNames:fieldNames,
                authenticated: true
            });
        });
    });

    router.get('/:name/list', function(req, res) {
        if (!(req.params.name in definitions)) {
            res.status(403).send({success:false})
            return console.log(`${req.params.name} was not in definitions`);
        }
        let collection = definitions[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({success:false})
            return console.log(`${req.session.userId} was not in the users of req.params.name`);
        }
        
        //db.collection(req.params.name).find(req.session.admin ? {} : {userId: req.session.userId}).sort({modified:-1}).toArray((err, result) => {
        let match = req.session.admin ? {} : {userId: req.session.userId};
        db.collection(req.params.name).aggregate([
                {"$match": match},
                {"$addFields": { "userId": { "$toObjectId": "$userId" }}},
                {"$lookup":{
                    "from": 'users',
                    "localField": 'userId',
                    "foreignField": '_id',
                    "as": 'user'
                }},
                {"$unwind": "$user"},
                {"$project":{
                    "id":{ $cond: { if: { $ne:["$id", ""] }, then:"$id", else:"untitled" } },
                    "bibliography":{"headline":1},
                    "article":{"abstract":1},
                    "user":{"name":1},
                    "modified":1
                }},
                {"$sort":{"modified":-1}}
            ]).toArray((err, result) => {
            if (err) {
                res.status(404).send({success:false})
                return console.log(err);
            }
            if (req.query.csv) {
                exportCsv(definitions[req.params.name].templates.csv.default, result, res);
            }
            else {
                res.render('db_list.ejs', {
                    title: `Collection: ${collection.friendlyName}`,
                    collection: collection,
                    articles:result,
                    queryNames:queryNames,
                    fieldNames:fieldNames,
                    authenticated: true
                });
            }
        });
    });

    router.post('/:name/upload', function(req, res) {
        if (!(req.params.name in definitions)) {
            res.status(403).send({success:false})
            return
        }
        let collection = definitions[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({success:false})
            return
        }

        new formidable.IncomingForm().parse(req, async (err, fields, files) => {
            if (err) {
                console.error('Error', err)
                throw err
            }
            console.log('Fields', fields);
            console.log('Files', files);

            console.log(`using token ${JSON.stringify(req.session.authToken)}`);

            let auth = drive.getAuth(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URI, req.session.authToken);

            console.log(`Got auth ${auth}`);

            let id = await drive.getFolder(auth, collection.drive.folder);
            console.log(`Folder id is ${id}`);
            
            drive.createOrUpdateFile(auth, files.file.name, files.file.type, fs.createReadStream(files.file.path), [id])
            .then(data => {
                console.log(`The file is saved to google ${JSON.stringify(data)}`);
                res.send({success:true, data:data});
            })
            .catch(err => {
                console.error(`The file is not saved to google ${err}`);
                res.send({success:false});
            })
        })
    });

    return router
}

module.exports = {
    getRouter: getRouter
}