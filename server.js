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
        useUnifiedTopology: true,
        useNewUrlParser: true,
        //reconnectTries: Number.MAX_VALUE,
        //reconnectInterval: 1000 
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

    fetchDefinitions(db, ()=>{
        defineRoutes();

        app.listen(process.env.PORT, () => {
            console.log(`listening on ${process.env.PORT}`)
        });
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
    "edit"
];

const definitions = {}

function fetchDefinitions(db, next) {
    db.collection('definitions').find({}).toArray((err, result) => {
        if (err) return console.log(err);
        result.forEach(definition=>{
            definitions[definition.name] = definition;
        });
        next();
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
        res.redirect(`/db/thaidb/list/${req.params.name}`)
    })

    app.get('/list/:name/:value', function(req, res) {
        res.redirect(`/db/thaidb/list/${req.params.name}/${req.params.value}`)
    })

    app.get('/count/:name', function(req, res) {
        res.redirect(`/db/thaidb/count/${req.params.name}`)
    })

    app.get('/count/:name/:value', function(req, res) {
        res.redirect(`/db/thaidb/count/${req.params.name}/${req.params.value}`)
    })

    app.get('/group/:first/:second', function(req, res) {
        res.redirect(`/db/thaidb/group/${req.params.first}/${req.params.second}`)
    });

    app.get('/group/:first/:second/:valueFirst/:valueSecond', function(req, res) {
        res.redirect(`/db/thaidb/group/${req.params.first}/${req.params.second}/${req.params.valueFirst}/${req.params.valueSecond}`)
    });

    app.get('/map/:param/:value', function(req, res) {
        res.redirect(`/db/thaidb/map/${req.params.param}/${req.params.value}`)
    });

    app.get('/new', function(req, res) {
        res.redirect("/db/thaidb/new")
    });

    app.get('/edit/:id', function(req, res) {
        res.redirect(`/db/thaidb/edit/${req.params.id}`)
    });

}