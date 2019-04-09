const express = require('express')                              // Webserver

function getRouter(db, collections, queryNames, fieldNames) {
    let router = express.Router()

    router.use(function (req, res, next) {
        if (!req.session || !req.session.userId) {
            return res.redirect(`/login?redirect=${encodeURIComponent(req.url)}`);
        }
        next();
    });

    router.post('/:name/save', function(req, res) {
        if (!(req.params.name in collections)) {
            res.status(403).send({success:false})
            return
        }
        let collection = collections[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({success:false})
            return
        }

        // Get json
        let json = req.body
        // Add user id
        json.userId = req.session.userId

        // Insert or update
        db.collection(req.params.name).updateOne({id:json.id}, {$set:json}, {upsert: true}, function(err, result) {
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
        if (!(req.params.name in collections)) {
            res.status(403).send({success:false})
            return
        }
        let collection = collections[req.params.name]
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
        if (!(req.params.name in collections)) {
            res.status(403).send({success:false})
            return
        }
        let collection = collections[req.params.name]
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
                },
                collection: "training"
            },
            queryNames:queryNames,
            fieldNames:fieldNames,
            authenticated: true
        })
    })

    router.get('/:name/edit/:id', function(req, res) {
        if (!(req.params.name in collections)) {
            res.status(403).send({success:false})
            return
        }
        let collection = collections[req.params.name]
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
                queryNames:queryNames,
                fieldNames:fieldNames,
                authenticated: true
            });
        });
    });

    router.get('/:name/list', function(req, res) {
        if (!(req.params.name in collections)) {
            res.status(403).send({success:false})
            return
        }
        let collection = collections[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({success:false})
            return
        }
        
        db.collection(req.params.name).find(req.session.admin ? {} : {userId: req.session.userId}).toArray((err, result) => {
            if (err) {
                res.status(404).send({success:false})
                return console.log(err);
            }
            if (req.query.csv) {
                exportCsv(definitions[req.params.name].templates.csv.default, result, res);
            }
            else {
                res.render('db_list.ejs', {
                    title: `collection: ${req.params.name}`,
                    name: req.params.name,
                    articles:result,
                    queryNames:queryNames,
                    fieldNames:fieldNames,
                    authenticated: true
                });
            }
        });
    });

    return router
}

module.exports = {
    getRouter: getRouter
}