const express = require('express')                              // Webserver
const formidable = require('formidable');                       // File upload
const fs = require('fs');                                       // File upload
const drive = require("./../drive");                            // Google drive
const stats = require("./../stats")                             // Statistics

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
            authenticated: true,
            admin:req.session.admin
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
            if (result.meta && result.meta.comments) {
                result.meta.comments.forEach(comment => {
                    comment.owned = comment.userId == req.session.userId
                    delete comment.userId
                })
            }
            res.render('new.ejs', {
                name: req.params.name,
                data: result,
                collection: collection,
                queryNames: queryNames,
                fieldNames: fieldNames,
                authenticated: true,
                admin: req.session.admin,
                userId : req.session.userId
            });
        });
    });

    router.post('/:name/article/:articleId/comments/add', function(req, res) {
        if (!(req.params.name in definitions)) {
            res.status(403).send({
                success:false, 
                message: `This user doesn't have access to ${collection.friendlyName}`
            })
            return
        }
        let collection = definitions[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({
                success:false, 
                message: `This user doesn't have access to ${collection.friendlyName}`
            })
            return
        }
        
        const data = req.body
        console.log("add", data)
        if (data.text) {
            const ObjectId = require('mongodb').ObjectID;
            let id = new ObjectId()
            db.collection(req.params.name).updateOne(
                { id: req.params.articleId },
                { $push: { "meta.comments": {
                    id: id,
                    text: data.text, 
                    userId: ObjectId(req.session.userId), 
                    userName: req.session.name 
                } } },
                (err, result) => {
                    if (err) {
                        res.status(404).send({success:false})
                        return console.log(err);
                    }
                    res.send({id:id.valueOf(), text:data.text, userName:req.session.name, owned:true})
                }
            )
        }
        else {
            res.status(400).send({success:false, message:"Comment text is missing"})
        }
    })

    router.post('/:name/article/:articleId/comments/remove', function(req, res) {
        if (!(req.params.name in definitions)) {
            res.status(403).send({
                success:false, 
                message: `This user doesn't have access to ${collection.friendlyName}`
            })
            return
        }
        let collection = definitions[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({
                success:false, 
                message: `This user doesn't have access to ${collection.friendlyName}`
            })
            return
        }

        const data = req.body
        console.log("remove", data)
        if (data.id) {
            const ObjectId = require('mongodb').ObjectID;
            db.collection(req.params.name).updateOne(
                { id: req.params.articleId },
                { $pull: { "meta.comments": { id: ObjectId(data.id), userId: ObjectId(req.session.userId) } } },
                (err, result) => {
                    if (err) {
                        res.status(404).send({success:false, message:"Failed to delete comment"})
                        return console.log(err);
                    }
                    res.send({success:true})
                }
            )
        }
        else {
            res.status(400).send({success:false, message:"Comment id is missing"})
        }
    })

    router.post('/:name/article/:articleId/status', function(req, res) {
        if (!(req.params.name in definitions)) {
            res.status(403).send({
                success:false, 
                message: `This user doesn't have access to ${collection.friendlyName}`
            })
            return
        }
        let collection = definitions[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({
                success:false, 
                message: `This user doesn't have access to ${collection.friendlyName}`
            })
            return
        }

        const data = req.body
        console.log("status", data)

        if (data.status) {
            db.collection(req.params.name).updateOne(
                { id: req.params.articleId },
                { $set: { "meta.status": data.status } },
                (err, result) => {
                    if (err) {
                        res.status(404).send({success:false, message:"Failed to update status"})
                        return console.log(err);
                    }
                    res.send({success:true, status:data.status})
                }
            )
        }
        else {
            res.status(400).send({success:false, message:"Status is missing"})
        }
    })

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
        let sort = "modified"
        let order = -1
        let stages = []
        let match = req.session.admin ? {} : {userId: req.session.userId}
        stages.push({"$match": match})
        if (!req.query.csv) {
            // Change string to id
            stages.push({
                "$addFields": {
                    "userId": { "$toObjectId": "$userId" },
                    "created": { "$toDate": "$_id" }
                }
            })
            // Do a join with the user table
            stages.push({"$lookup":{
                "from": 'users',
                "localField": 'userId',
                "foreignField": '_id',
                "as": 'user'
            }})
            // Unwind, as user will be an array even when only one element is matched
            stages.push({"$unwind": {
                path: "$user",
                preserveNullAndEmptyArrays: true
            }})
            // Project in order to erase sensitive user data
            stages.push({"$project":{
                "id":{ $cond: { if: { $ne:["$id", ""] }, then:"$id", else:"untitled" } },
                "bibliography":{"headline":1},
                "article":{"abstract":1},
                "user":{"name":1},
                "modified":1,
                "created":1,
                "draft":1
            }})
            // Sort by modified
            const validSort = ["modified", "created", "id", "user", "draft"]
            if (validSort.includes(req.query.sort)) {
                sort = req.query.sort ? req.query.sort : "modified"
                order = req.query.order === "ascending" ? 1 : -1
            }
            const map = {}
            map[sort] = order
            stages.push({"$sort":map})
        }
        else {
            sort = "id"
            order = 1
            stages.push({"$sort":{"id":1}})
        }
        console.log(JSON.stringify(stages))
        db.collection(req.params.name).aggregate(stages).toArray((err, result) => {
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
                    authenticated: true,
                    sort: sort,
                    order: order
                });
            }
        });
    });

    router.get('/:name/list/:param', function(req, res) {
        if (!(req.params.name in definitions)) {
            res.status(403).send({success:false})
            return console.log(`${req.params.name} was not in definitions`);
        }
        let collection = definitions[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({success:false})
            return console.log(`${req.session.userId} was not in the users of req.params.name`);
        }

        let name = req.params.param;
        //db.collection(req.params.name).distinct(name, (err, result) => {
        let group = req.params.param;
        let aggregate = [];
        aggregate.push({$addFields: { "categories.happening": { $ifNull: [ "$categories.happening", "$categories.happenings" ] }}});
        if (group.startsWith("categories.happening")) {
            aggregate.push({$unwind:"$categories.happening"});
        }
        if (group == "categories.topics") {
            aggregate.push({$unwind:"$categories.topics"});
        }
        if (group == "article.keywords") {
            aggregate.push({$unwind:"$article.keywords"});
        }
        if (group.startsWith("categories.people")) {
            aggregate.push({$unwind:"$categories.people"});
        }
        group = "$" + group;
        aggregate.push({ $group : { _id : group } });
        console.log(group, aggregate);
        db.collection(req.params.name).aggregate(aggregate).toArray((err, result) => {
            if (err) return console.log(err);
            result = result.filter(article => article && article._id != "");
            result = result.map(v=>v._id)
            result.sort();
            res.render('list.ejs', {
                articles:result, 
                attribute:name, 
                title:`${collection.friendlyName}.distinct(${name})`,
                query:`distinct(${name})`,
                collection:collection,
                queryNames:queryNames,
                fieldNames:fieldNames,
                authenticated: true
            });
        });
    })

    router.get('/:name/list/:param/:value', function(req, res) {
        if (!(req.params.name in definitions)) {
            res.status(403).send({success:false})
            return console.log(`${req.params.name} was not in definitions`);
        }
        let collection = definitions[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({success:false})
            return console.log(`${req.session.userId} was not in the users of req.params.name`);
        }

        let name = req.params.param;
        let aggregate = [];
        aggregate.push({$addFields: { "categories.happening": { $ifNull: [ "$categories.happening", "$categories.happenings" ] }}});
        /*if (name.startsWith("categories.happening")) {
            aggregate.push({$unwind:"$categories.happening"});
        }
        if (name == "categories.topics") {
            aggregate.push({$unwind:"$categories.topics"});
        }
        if (name == "article.keywords") {
            aggregate.push({$unwind:"$article.keywords"});
        }*/
        aggregate.push({$match:{[name]: req.params.value}});
        console.log(name, req.params.value, aggregate);
        db.collection(req.params.name).aggregate(aggregate).toArray((err, result) => {
        //db.collection('thaidb').find({[name]: req.params.value}).toArray((err, result) => {
            if (err) return console.log(err);
            result = result.filter(article => article && article._id != "");
            if (req.query.csv) {
                exportCsv(definitions.thaidb.templates.csv.default, result, res);
            }
            else {
                res.render('db_list.ejs', {
                    articles:result, 
                    title:`${name} - ${req.params.value}`,
                    query:`filter(${name}:${req.params.value})`,
                    collection:collection,
                    queryNames:queryNames,
                    fieldNames:fieldNames,
                    authenticated: true
                });
            }
        });
    })

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

    router.use(function (req, res, next) {
        if (!req.session.admin) {
            return res.sendStatus(403)
        }
        next();
    });

    router.get('/:name/count/:param', function(req, res) {
        if (!(req.params.name in definitions)) {
            res.status(403).send({success:false})
            return
        }
        let collection = definitions[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({success:false})
            return
        }

        let group = req.params.param;
        let aggregate = [];
        aggregate.push({$addFields: { "categories.happening": { $ifNull: [ "$categories.happening", "$categories.happenings" ] }}});
        if (group.startsWith("categories.happening")) {
            aggregate.push({$unwind:"$categories.happening"});
        }
        if (group == "categories.topics") {
            aggregate.push({$unwind:"$categories.topics"});
        }
        if (group == "article.keywords") {
            aggregate.push({$unwind:"$article.keywords"});
        }
        if (group.startsWith("categories.people")) {
            aggregate.push({$unwind:"$categories.people"});
        }
        group = "$" + group;
        aggregate.push({$sortByCount:group});
        console.log(group, JSON.stringify(aggregate));
        db.collection(req.params.name).aggregate(aggregate).toArray((err, result) => {
            if (err) return console.log(err)
            //result = result.filter(article => article._id && article._id != "");
            let articles = result.map(article => ({name:article._id, count:article.count}));
            let count = result.map(article => article.count);
            let statistics = { stdev: stats.stdevp(count), mean: stats.meanp(count), confidence:stats.confidence(0.05, stats.stdevp(count), count.length) };
            console.log(statistics);
            let template = {
                [req.params.param]: "name",
                Count: "count"
            };
            if (req.query.csv) {
                exportCsv(template, articles, res);
            }
            else {
                res.render('count.ejs', {
                    articles:articles,
                    collection:collection,
                    count:count,
                    dbName:req.params.name,
                    attribute:req.params.param, 
                    title:`${req.params.name}.count(${req.params.param})`, 
                    query:`count(${req.params.param})`,
                    statistics:statistics,
                    queryNames:queryNames,
                    fieldNames:fieldNames,
                    authenticated: true
                });
            }
        });
    });

    router.get('/:name/count/:param/:value', function(req, res) {
        if (!(req.params.name in definitions)) {
            res.status(403).send({success:false})
            return
        }
        let collection = definitions[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({success:false})
            return
        }

        let name = req.params.param;
        let aggregate = [];
        aggregate.push({$addFields: { "categories.happening": { $ifNull: [ "$categories.happening", "$categories.happenings" ] }}});
        /*if (name.startsWith("categories.happening")) {
            aggregate.push({$unwind:"$categories.happening"});
        }
        /*if (name == "categories.topics") {
            aggregate.push({$unwind:"$categories.topics"});
        }
        if (name == "article.keywords") {
            aggregate.push({$unwind:"$article.keywords"});
        }*/
        aggregate.push({$match:{[name]: req.params.value}});
        console.log(name, req.params.value, aggregate);
        db.collection(req.params.name).aggregate(aggregate).toArray((err, result) => {
        //db.collection('thaidb').find({[name]: req.params.value}).toArray((err, result) => {
            if (err) return console.log(err);
            result = result.filter(article => article && article._id != "");
            if (req.query.csv) {
                exportCsv(definitions.thaidb.templates.csv.default, result, res);
            }
            else {
                res.render('db_list.ejs', {
                    articles:result, 
                    title:`${req.params.name}.filter(${req.params.param}:${req.params.value}`,
                    query: `filter(${req.params.param}:${req.params.value})`,
                    collection: collection,
                    queryNames:queryNames,
                    fieldNames:fieldNames,
                    authenticated: true
                });
            }
        });
    })

    router.get('/:name/group/:first/:second', function(req, res) {
        if (!(req.params.name in definitions)) {
            res.status(403).send({success:false})
            return
        }
        let collection = definitions[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({success:false})
            return
        }

        let firstGroup = req.params.first;
        let secondGroup = req.params.second;
        let aggregate = [];
        aggregate.push({$addFields: { "categories.happening": { $ifNull: [ "$categories.happening", "$categories.happenings" ] }}});
        if ([firstGroup, secondGroup].some(name => name.startsWith("categories.happening"))) {
            aggregate.push({$unwind:"$categories.happening"});
        }
        if ([firstGroup, secondGroup].some(name => name.startsWith("categories.topics"))) {
            aggregate.push({$unwind:"$categories.topics"});
        }
        if ([firstGroup, secondGroup].some(name => name.startsWith("article.keywords"))) {
            aggregate.push({$unwind:"$article.keywords"});
        }
        if ([firstGroup, secondGroup].some(name => name.startsWith("categories.people"))) {
            aggregate.push({$unwind:"$categories.people"});
        }
        firstGroup = "$" + firstGroup;
        secondGroup = "$" + secondGroup;
        aggregate.push({$sortByCount:{$mergeObjects:{first:firstGroup,second:secondGroup}}});
        console.log(firstGroup, secondGroup, aggregate);
        db.collection(req.params.name).aggregate(aggregate).toArray((err, result) => {
            if (err) return console.log(err)
            result = result.filter(article => article._id.first && article._id.first != "" && article._id.second && article._id.second != "");

            if (req.query.csv) {
                let articles = result.map(article => `"${article._id.first}", "${article._id.second}", "${article.count}"`);
                res.attachment(`${req.params.first}-${req.params.second}.csv`);
                res.status(200).send(articles.join("\n"));
            }
            else {
                let statistics = {}
                {
                    let data = result.map(article => [article._id.first, article._id.second, article.count])
                    let count = data.reduce((a,v)=>a+v[2], 0)
                    let[xIndices, xKeys] = stats.factorize(data.map(v=>v[0]))
                    let[yIndices, yKeys] = stats.factorize(data.map(v=>v[1]))
                    let columns = xKeys.length
                    let rows = yKeys.length
                    let observed = new Array(columns*rows).fill(0)
                    data.forEach((v,i)=>{
                        observed[xIndices[i]+yIndices[i]*columns] = v[2]
                    })
                    let expected = new Array(columns*rows).fill(0)
                    let colCount = xKeys.map(k=>data.filter(v=>v[0]==k).map(v=>v[2]).reduce((a,v)=>a+v, 0))
                    let rowCount = yKeys.map(k=>data.filter(v=>v[1]==k).map(v=>v[2]).reduce((a,v)=>a+v, 0))
                    for (let i = 0; i < columns; i++) {
                        for (let j = 0; j < rows; j++) {
                            expected[j*columns+i] = colCount[i]*rowCount[j]/count
                        }
                    }
                    statistics.v = stats.cramersv(observed, expected, count, columns, rows)
                    let pX = colCount.map(v=>v/count)
                    let pY = rowCount.map(v=>v/count)
                    let hX = -pX.reduce((a,v)=>a+v*Math.log(v), 0)
                    let hY = -pY.reduce((a,v)=>a+v*Math.log(v), 0)
                    console.log(pX, pY, hX, hY)
                    let pXY = observed.map(v=>v/count)
                    let hXY = pXY.reduce((a,v,i)=>v==0 ? a : a+v*Math.log(pY[Math.floor(i/columns)]/v), 0)
                    let hYX = pXY.reduce((a,v,i)=>v==0 ? a : a+v*Math.log(pX[Math.floor(i%columns)]/v), 0)
                    console.log(pXY, hXY, hYX)
                    let uXY = (hX-hXY)/hX
                    let uYX = (hY-hYX)/hY
                    statistics.uxy = uXY
                    statistics.uyx = uYX
                }

                let articles = result.map(article => ({first:article._id.first, second:article._id.second, count:article.count}));
                let count = req.query.chart ? result.map(article => article.count) : false;
                let labels = [];
                let categories = [];
                console.log(result.slice(0, 10))
                result.some(r => {
                    label = r._id.first;
                    if (labels.findIndex(l => l == label) == -1)
                        labels.push(label);
                    return labels.length >= 10;
                });
                result.some(r => {
                    category = r._id.second;
                    if (categories.findIndex(c => c == category) == -1)
                        categories.push(category);
                    return categories.length >= 7;
                });
                let datasets = categories.map(_ => [...labels.map(_ => 0)]);
                let first, second, labelIndex, categoryIndex;
                result.forEach(r => {
                    first = r._id.first;
                    second = r._id.second;
                    labelIndex = labels.findIndex(l => l == first);
                    categoryIndex = categories.findIndex(c => c == second);
                    if (labelIndex > -1 && categoryIndex > -1) {
                        datasets[categoryIndex][labelIndex] = r.count;
                    }
                });
                if (req.query.percentage) {
                    labels.forEach((_, l) => {
                        let sum = categories.reduce((a, _, c) => a + datasets[c][l], 0);
                        categories.forEach((_, c) => datasets[c][l] /= sum);
                    });
                }
                console.log(articles, labels, categories, datasets);

                res.render('group.ejs', {
                    collection:collection,
                    articles:articles, 
                    count:count,
                    dbName:req.params.name,
                    title:`${req.params.name}.group(${req.params.first}, ${req.params.second})`,
                    query:`group(${req.params.first}, ${req.params.second})`,
                    first:req.params.first, 
                    second:req.params.second, 
                    labels:labels, 
                    categories:categories, 
                    datasets:datasets,
                    queryNames:queryNames,
                    fieldNames:fieldNames,
                    authenticated: true,
                    statistics: statistics
                });
            }
        });
    })

    router.get('/:name/group/:first/:second/:valueFirst/:valueSecond', function(req, res) {
        if (!(req.params.name in definitions)) {
            res.status(403).send({success:false})
            return
        }
        let collection = definitions[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({success:false})
            return
        }

        let nameFirst = req.params.first;
        let nameSecond = req.params.second;
        //db.collection(req.params.name).find({[nameFirst]: req.params.valueFirst, [nameSecond]: req.params.valueSecond}).toArray((err, result) => {
        let firstGroup = req.params.first;
        let secondGroup = req.params.second;
        let aggregate = [];
        aggregate.push({$addFields: { "categories.happening": { $ifNull: [ "$categories.happening", "$categories.happenings" ] }}});
        if ([firstGroup, secondGroup].some(name => name.startsWith("categories.happening"))) {
            aggregate.push({$unwind:"$categories.happening"});
        }
        if ([firstGroup, secondGroup].some(name => name.startsWith("categories.topics"))) {
            aggregate.push({$unwind:"$categories.topics"});
        }
        if ([firstGroup, secondGroup].some(name => name.startsWith("article.keywords"))) {
            aggregate.push({$unwind:"$article.keywords"});
        }
        if ([firstGroup, secondGroup].some(name => name.startsWith("categories.people"))) {
            aggregate.push({$unwind:"$categories.people"});
        }
        firstGroup = "$" + firstGroup;
        secondGroup = "$" + secondGroup;
        aggregate.push({$match:{[nameFirst]: req.params.valueFirst, [nameSecond]: req.params.valueSecond}});
        console.log(firstGroup, secondGroup, aggregate);
        db.collection(req.params.name).aggregate(aggregate).toArray((err, result) => {
            if (err) return console.log(err);
            res.render('db_list.ejs', {
                articles:result, 
                title:`${req.params.name}.filter(${req.params.first}:${req.params.valueFirst}, ${req.params.second}:${req.params.valueSecond})`,
                query:`filter(${req.params.first}:${req.params.valueFirst}, ${req.params.second}:${req.params.valueSecond})`,
                collection: collection,
                queryNames:queryNames,
                fieldNames:fieldNames,
                authenticated: true
            });
        });
    });

    router.get('/:name/map/:param/:value', function(req, res) {
        if (!(req.params.name in definitions)) {
            res.status(403).send({success:false})
            return
        }
        let collection = definitions[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({success:false})
            return
        }

        let group = req.params.param;
        let aggregate = [];
        aggregate.push({$addFields: { "categories.happening": { $ifNull: [ "$categories.happening", "$categories.happenings" ] }}});
        if ([group].some(name => name.startsWith("categories.happening"))) {
            aggregate.push({$unwind:"$categories.happening"});
        }
        if ([group].some(name => name.startsWith("categories.topics"))) {
            aggregate.push({$unwind:"$categories.topics"});
        }
        if ([group].some(name => name.startsWith("article.keywords"))) {
            aggregate.push({$unwind:"$article.keywords"});
        }
        aggregate.push({$match:{[group]:req.params.value}});
        aggregate.push({$sortByCount:"$categories.place.geo"});
        console.log(group, aggregate);
        db.collection(req.params.name).aggregate(aggregate).toArray((err, result) => {
            if (err) return console.log(err)
            result = result.filter(article => article._id && article._id != "");
            data = {};
            result.forEach(record => {
                let province = record._id.split(",")[1];
                data[province] = (data[province] || 0) + record.count;
            });
            data = Object.entries(data).map(([province, count]) => ({name:province, count:count}));
            res.render('map.ejs', {
                articles:data, 
                attribute:req.params.param, 
                value:req.params.value,
                collection: collection,
                title:`${req.params.name}.map(${req.params.param}, ${req.params.value})`,
                query:`map(${req.params.param}, ${req.params.value})`,
                queryNames:queryNames,
                fieldNames:fieldNames,
                authenticated: true,
                mapboxAccessToken:process.env.MAPTOKEN
            });
        });
    });

    router.get('/:name/search', function(req, res) {
        if (!(req.params.name in definitions)) {
            res.status(403).send({success:false})
            return
        }
        let collection = definitions[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({success:false})
            return
        }

        db.collection(req.params.name).find({ $text: { $search: req.query.query } }, {"article.abstract":1, _id:1}).toArray((err, result) => {
            if (err) return console.log(err);
            result.sort();
            res.render('db_list.ejs', {
                articles:result, 
                attribute:req.params.name, 
                collection:collection,
                title:`${req.params.name}.filter(abstract contains [${req.query.query.split(" ").filter(v=>v).join(",")}])`,
                query:`filter(abstract contains [${req.query.query.split(" ").filter(v=>v).join(",")}])`,
                queryNames:queryNames,
                fieldNames:fieldNames,
                authenticated: true
            });
        });
    })

    router.get('/:name/report', function(req, res) {
        res.redirect(`/db/${req.params.name}/report/weekly`)
    })

    router.get('/:name/report/:by', function(req, res) {
        if (!(req.params.name in definitions)) {
            res.status(403).send({success:false})
            return
        }
        let collection = definitions[req.params.name]
        if (!collection.users.includes(req.session.userId)) {
            res.status(403).send({success:false})
            return
        }

        let aggregate = [];
        
        // We only need the creation date and user
        aggregate.push({ $project: 
            { 
                _id: 1,
                created: { $toDate: "$_id" },
                userId: 1
            }
        });
        // Lookup the user in users by userId
        aggregate.push({"$addFields": { "userId": { "$toObjectId": "$userId" }}})
        aggregate.push({ $lookup:
            {
                "from": 'users',
                "localField": 'userId',
                "foreignField": '_id',
                "as": 'user'
            }
        })
        aggregate.push({ $unwind: "$user" })
        // Group by time period
        let period = { $week: "$created" }
        if (req.params.by === "monthly") {
            period = { $month: "$created" }
        }
        else if (req.params.by === "yearly") {
            period = { $year: "$created" }
        }
        aggregate.push({ $group: 
            {
                _id: {
                    year: { $year: "$created" },
                    period: period,
                    user: "$user.name"
                },
                count: { $sum: 1 }
            }
        });
        // Sort
        aggregate.push({ $sort: { "_id.year": -1, "_id.period": -1 } });
        console.log(period, aggregate);
        db.collection(req.params.name).aggregate(aggregate).toArray((err, result) => {
            if (err) return console.log(err)
            res.render('report.ejs', {
                articles:result, 
                unit:req.params.by,
                title:`Report ${collection.friendlyName} by ${req.params.by}`,
                query:`Report ${collection.friendlyName} by ${req.params.by}`,
                collection:collection,
                queryNames:queryNames,
                fieldNames:fieldNames,
                authenticated: true
            });
        });
    })

    return router
}

module.exports = {
    getRouter: getRouter
}