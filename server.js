const express = require('express');                             // Webserver
const bodyParser= require('body-parser');                       // Form parser
const MongoClient = require('mongodb').MongoClient;             // MongoDB database
const app = express();                                          // Webserver app
const stats = require("./stats")                                // Statistics
const fieldNames = require("./field_names")                     // Query settings
const bcrypt = require('bcrypt');                               // Password encryption
const ExpressSession = require('express-session');              // Sessions
const nodemailer = require('nodemailer');                       // Mail sender
const MongoStore = require('connect-mongo')(ExpressSession);    // MongoDB backed sessions
const formidable = require('formidable');                       // File upload
const {google} = require('googleapis');                         // Google drive upload
const fs = require('fs');                                       // File upload
const exportCsv = require("./csv_export");
const drive = require("./drive");

require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_ADDRESS,
        pass: process.env.MAIL_PASSWORD
    }
});

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static('resources'))

/*bcrypt.hash("", 10, function (err, hash){
    if (err) return console.log(err);
    console.log(hash);
});*/

var db

async function connect() {

    let client = new MongoClient(`mongodb+srv://${process.env.MONGOUSER}:${process.env.MONGOPASSWORD}@${process.env.SERVER}?retryWrites=true`, {
        useNewUrlParser: true,
        reconnectTries: Number.MAX_VALUE,
        reconnectInterval: 1000 
    });

    await client.connect();
    db = client.db('thaidb');

    let store = new MongoStore({
        db: db,
        collection: 'sessions',
        ttl: 24 * 60 * 60
    });

    store.once('connected', () => {
        console.log("sessions connected");
    });

    app.use(ExpressSession({
        secret: process.env.SECRET,
        saveUninitialized:true,
        resave: false,
        store: store
    }));

    try {
        const reset = require('./routes/reset_router').getRouter(db, transporter);
        app.use('/reset', reset);
        console.log("reset route installed");
    }
    catch (err) {
        console.log(err);
    }

    try {
        const login = require('./routes/login_router').getRouter(db, transporter);
        app.use('/login', login);
        console.log("login route installed");
    }
    catch (err) {
        console.log(err);
    }

    try {
        const dbRouter = require('./routes/db_router').getRouter(db, definitions, queryNames, fieldNames, process);
        app.use('/db', dbRouter);
        console.log("db route installed");
    }
    catch (err) {
        console.log(err);
    }

    fetchDefinitions(db);

    defineRoutes();

    app.listen(process.env.PORT, () => {
        console.log(`listening on ${process.env.PORT}`)
    });
}

try {
    connect();
}
catch (err) {
    console.error('Error connecting to db:', err)
}

const queryNames = [
    "all",
    "article",
    "list",
    "count",
    "group",
    "map",
    "search",
    "new",
    "edit",
    "training/new",
    "training/edit",
    "training/list"
];

const definitions = {}

function fetchDefinitions(db) {
    db.collection('definitions').find({}).toArray((err, result) => {
        if (err) return console.log(err);
        result.forEach(definition=>{
            definitions[definition.name] = definition;
        });
    });
}

function isAuthenticated(req) {
    return req.session && req.session.userId ? true : false;
}

function isAdmin(req) {
    return req.session && req.session.admin ? true : false;
}

function defineRoutes() {

    // Everything from hereon needs authentication
    app.use(function (req, res, next) {
        if (!isAuthenticated(req)) {
            return res.redirect(`/login?redirect=${encodeURIComponent(req.url)}`);
        }
        next();
    });

    app.get('/logout', function(req, res) {
        req.session.destroy(function(err) {
            if (err) return console.log(err);
            res.render('login.ejs', {
                title: "Login",
                email: "",
                queryNames:queryNames,
                fieldNames:fieldNames,
                authenticated: true
            });
        });
    })

    app.get('/isauth', (req, res) => {
        console.log(`Token is ${req.session.authToken}`);
        let authUrl = drive.hasToken(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URI, req.session.authToken)
        console.log(authUrl);
        res.send(authUrl !== true ? {success:false, authUrl:authUrl} : {success:true});
    });

    app.get('/auth', async (req, res) => {
        let code = req.query.code;
        let error = req.query.error;
        console.log(`auth code: ${code} auth error: ${error}`);
        let token = await drive.authenticate(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URI, code, error);
        req.session.authToken = token;
        res.render('auth.ejs', {});
    });

    app.get('/redirected', async (req, res) => {
        let code = req.query.code;
        let error = req.query.error;
        console.log(`auth code: ${code} auth error: ${error}`);
        let token = await drive.authenticate(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URI, code, error);
        req.session.authToken = token;
        res.render('auth.ejs', {});
    });

    /*app.post('/training/upload', function(req, res) {
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

            let id = await drive.getFolder(auth, 'Thai_uploads');
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

    app.post('/training/save', function(req, res) {
        let json = req.body;
        json.userId = req.session.userId;
        console.log(json);
        //response.send(req.body);
        
        db.collection("trainingdb").updateOne({id:json.id}, {$set:json}, { upsert: true }, function(err, result) {
            if (err) {
                res.status(200).send({success:false});
                console.log("error", err);
            }
            else {
                res.status(200).send({success:true});
                console.log(json.id + " document updated");
            }
        });
    });

    app.get('/training/delete/:id', function(req, res) {
        db.collection("trainingdb").deleteOne({id:req.params.id, userId:req.session.userId}, function(err, result) {
            if (err) {
                console.log(err);
                return res.redirect('/training/list');
            }
            else {
                console.log(req.params.id + " document deleted");
                return res.redirect('/training/list');
            }
        });
    });

    app.get('/training/new', function(req, res) {
        res.render('new.ejs', {
            name: "trainingdb",
            data:{
                categories:{
                    place:{
                        geo:"thailand,bangkok,,"
                    }
                }
            },
            queryNames:queryNames,
            fieldNames:fieldNames,
            authenticated: true
        });
    });

    app.get('/training/edit/:id', function(req, res) {
        db.collection('trainingdb').findOne({id: req.params.id}, (err, result) => {
            if (err) return console.log(err);
            res.render('new.ejs', {
                data:result,
                queryNames:queryNames,
                fieldNames:fieldNames,
                authenticated: true,
                collection: "training"
            });
        });
    });

    app.get('/training/list', function(req, res) {
        
        db.collection('trainingdb').find(req.session.admin ? {} : {userId: req.session.userId}).toArray((err, result) => {
            if (err) return console.log(err);
            if (req.query.csv) {
                exportCsv(definitions.trainingdb.templates.csv.default, result, res);
            }
            else {
                res.render('traininglist.ejs', {
                    title: "Training data",
                    articles:result,
                    queryNames:queryNames,
                    fieldNames:fieldNames,
                    authenticated: true
                });
            }
        });
    });*/

    app.get('/', function(req, res) {
        res.redirect("/db")
    })

    // Everything from hereon needs admin
    app.use(function (req, res, next) {
        if (!isAdmin(req)) {
            return res.redirect(`/db`);
        }
        next();
    });

    /*app.get('/', function(req, res) {
        db.collection('thaidb').find().toArray((err, result) => {
            if (err) return console.log(err);
            if (req.query.csv) {
                console.log(definitions.thaidb.templates.csv.default)
                exportCsv(definitions.thaidb.templates.csv.default, result, res);
            }
            else {
                res.render('index.ejs', {
                    articles:result, 
                    title:"All",
                    queryNames:queryNames,
                    fieldNames:fieldNames,
                    authenticated: true
                });
            }
        });
    })*/

    app.get('/article/:id', function(req, res) {
        db.collection('thaidb').findOne({id: req.params.id}, (err, result) => {
            if (err) return console.log(err);
            res.send(result);
        });
    })

    app.get('/list', function(req, res) {
        res.redirect("/db/thaidb/list")
    })

    app.get('/list/:name', function(req, res) {
        let name = req.params.name;
        db.collection('thaidb').distinct(name, (err, result) => {
            if (err) return console.log(err);
            result = result.filter(article => article && article._id != "");
            result.sort();
            res.render('list.ejs', {
                articles:result, 
                attribute:req.params.name, 
                title:`Distinct ${req.params.name}`,
                queryNames:queryNames,
                fieldNames:fieldNames,
                authenticated: true
            });
        });
    })

    app.get('/list/:name/:value', function(req, res) {
        let name = req.params.name;
        let aggregate = [];
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
        db.collection('thaidb').aggregate(aggregate).toArray((err, result) => {
        //db.collection('thaidb').find({[name]: req.params.value}).toArray((err, result) => {
            if (err) return console.log(err);
            result = result.filter(article => article && article._id != "");
            if (req.query.csv) {
                exportCsv(definitions.thaidb.templates.csv.default, result, res);
            }
            else {
                res.render('index.ejs', {
                    articles:result, 
                    title:`${req.params.name} - ${req.params.value}`,
                    queryNames:queryNames,
                    fieldNames:fieldNames,
                    authenticated: true
                });
            }
        });
    })

    app.get('/search', function(req, res) {
        db.collection('thaidb').find({ $text: { $search: req.query.query } }, {"article.abstract":1, _id:1}).toArray((err, result) => {
            if (err) return console.log(err);
            result.sort();
            res.render('index.ejs', {
                articles:result, 
                attribute:req.params.name, 
                title:req.params.name,
                queryNames:queryNames,
                fieldNames:fieldNames,
                authenticated: true
            });
        });
    })

    app.get('/count/:name', function(req, res) {
        let group = req.params.name;
        let aggregate = [];
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
        console.log(group, aggregate);
        db.collection('thaidb').aggregate(aggregate).toArray((err, result) => {
            if (err) return console.log(err)
            result = result.filter(article => article._id && article._id != "");
            let articles = result.map(article => ({name:article._id, count:article.count}));
            let count = result.map(article => article.count);
            let statistics = { stdev: stats.stdevp(count), mean: stats.meanp(count), confidence:stats.confidence(0.05, stats.stdevp(count), count.length) };
            console.log(statistics);
            let template = {
                [req.params.name]: "name",
                Count: "count"
            };
            if (req.query.csv) {
                exportCsv(template, articles, res);
            }
            else {
                res.render('count.ejs', {
                    articles:articles, 
                    count:count, 
                    attribute:req.params.name, 
                    title:`Count by ${req.params.name}`, 
                    statistics:statistics,
                    queryNames:queryNames,
                    fieldNames:fieldNames,
                    authenticated: true
                });
            }
        });
    })

    app.get('/group/:first/:second', function(req, res) {
        let firstGroup = req.params.first;
        let secondGroup = req.params.second;
        let aggregate = [];
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
        db.collection('thaidb').aggregate(aggregate).toArray((err, result) => {
            if (err) return console.log(err)
            result = result.filter(article => article._id.first && article._id.first != "" && article._id.second && article._id.second != "");

            if (req.query.csv) {
                let articles = result.map(article => `"${article._id.first}", "${article._id.second}", "${article.count}"`);
                res.attachment(`${req.params.first}-${req.params.second}.csv`);
                res.status(200).send(articles.join("\n"));
            }
            else {
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
                    articles:articles, 
                    count:count, 
                    first:req.params.first, 
                    second:req.params.second, 
                    labels:labels, 
                    categories:categories, 
                    datasets:datasets,
                    queryNames:queryNames,
                    fieldNames:fieldNames,
                    authenticated: true
                });
            }
        });
    })

    app.get('/group/:first/:second/:valueFirst/:valueSecond', function(req, res) {
        let nameFirst =req.params.first;
        let nameSecond = req.params.second;
        db.collection('thaidb').find({[nameFirst]: req.params.valueFirst, [nameSecond]: req.params.valueSecond}).toArray((err, result) => {
            if (err) return console.log(err);
            res.render('index.ejs', {
                articles:result, 
                title:`${req.params.first}:${req.params.valueFirst} - ${req.params.second}:${req.params.valueSecond}`,
                queryNames:queryNames,
                fieldNames:fieldNames,
                authenticated: true
            });
        });
    });

    app.get('/correlation/:group/:first/:second', function(req, res) {
        let nameGroup = map[req.params.group];
        let facets = {};
        [req.params.first, req.params.second].forEach(param => {
            let name = map[param];
            let facet = [];
            if ([nameGroup, name].some(name => name.startsWith("$categories.happening"))) {
                facet.push({$unwind:"$categories.happening"});
            }
            if ([nameGroup, name].some(name => name.startsWith("$categories.topics"))) {
                facet.push({$unwind:"$categories.topics"});
            }
            if ([nameGroup, name].some(name => name.startsWith("$article.keywords"))) {
                facet.push({$unwind:"$article.keywords"});
            }
            facet.push({$sortByCount:{$mergeObjects:{group:nameGroup,param:name}}});
            facets[param] = facet;
        })
        let aggregate = [{$facet:facets}];
        console.log(JSON.stringify(aggregate))
        db.collection('thaidb').aggregate(aggregate).toArray((err, result) => {
            if (err) return console.log(err);
            result = result[0];
            let data = {};
            let count = 0;
            let series = {};
            [req.params.first, req.params.second].forEach(param => {
                let params = {};
                data[param] = params;
                result[param].forEach(record => {
                    let index = series[record._id.group];
                    if (index == undefined) {
                        index = count++;
                        series[record._id.group] = index;
                    }
                    let array = params[record._id.param];
                    if (!array) {
                        array = [];
                        params[record._id.param] = array;
                    }
                    array[index] = record.count;
                });
            });
            seriesArray = [];
            Object.entries(series).forEach(([name, index]) => seriesArray[index] = name);
            [req.params.first, req.params.second].forEach(param => {
                Object.values(data[param]).forEach(array => {
                    for (let i = 0; i < seriesArray.length; i++) {
                        array[i] = array[i] || 0;
                    }
                    let total = array.reduce((v,a) => v+a);
                    for (let i = 0; i < seriesArray.length; i++) {
                        array[i] = array[i] / total;
                    }
                });
            });
            data.series = seriesArray;
            correlation = {};
            Object.entries(data[req.params.first]).forEach(([nameX, arrayX]) => {
                Object.entries(data[req.params.second]).forEach(([nameY, arrayY]) => {
                    correlation[`${req.params.first}-${nameX}-${req.params.second}-${nameY}`] = stats.covarp(arrayX, arrayY);
                });
            });
            data.correlation = correlation;
            res.status(200).send(data);
            //res.render('index.ejs', {articles:result, title:`${req.params.first}:${req.params.valueFirst} - ${req.params.second}:${req.params.valueSecond}`});
        });
    });

    app.get('/map/:param/:value', function(req, res) {
        let group = req.params.param;
        let aggregate = [];
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
        db.collection('thaidb').aggregate(aggregate).toArray((err, result) => {
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
                value:req.params.value , 
                title:`Map where ${req.params.param} is ${req.params.value}`,
                queryNames:queryNames,
                fieldNames:fieldNames,
                authenticated: true,
                mapboxAccessToken:process.env.MAPTOKEN
            });
            //res.status(200).send(result);
        });
    });

    app.post('/save', function(req, res) {
        let json = req.body;
        json.userId = req.session.userId;
        console.log(json);
        //response.send(req.body);
        
        db.collection("thaidb").updateOne({id:json.id}, {$set:json}, { upsert: true }, function(err, result) {
            if (err) {
                res.status(200).send({success:false});
                console.log("error", err);
            }
            else {
                res.status(200).send({success:true});
                console.log(json.id + " document updated");
            }
        });
    });

    app.get('/new', function(req, res) {
        res.redirect("/db/thaidb/new")
        /*res.render('new.ejs', {
            data:{},
            queryNames:queryNames,
            fieldNames:fieldNames,
            authenticated: true
        });*/
    });

    app.get('/edit/:id', function(req, res) {
        res.redirect(`/db/thaidb/edit/${req.params.id}`)
        /*db.collection('thaidb').findOne({id: req.params.id}, (err, result) => {
            if (err) return console.log(err);
            res.render('new.ejs', {
                data:result,
                queryNames:queryNames,
                fieldNames:fieldNames,
                authenticated: true
            });
        });*/
    });

}