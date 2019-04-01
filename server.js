const express = require('express');                             // Webserver
const bodyParser= require('body-parser');                       // Form parser
const MongoClient = require('mongodb').MongoClient;             // MongoDB database
const app = express();                                          // Webserver app
const stats = require("./stats")                                // Statistics
const fieldNames = require("./field_names")                     // Query settings
const bcrypt = require('bcrypt');                               // Password encryption
const ExpressSession = require('express-session');              // Sessions
const MongoStore = require('connect-mongo')(ExpressSession);   // MongoDB backed sessions
const formidable = require('formidable');                       // File upload
const {google} = require('googleapis');                         // Google drive upload
const fs = require('fs');                                       // File upload
const exportCsv = require("./csv_export");
const drive = require("./drive");

require('dotenv').load();

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

const csvTemplate = {
    ID: "id",
    Relevance: "relevance",
    Headline: "bibliography.headline",
    Newspaper: "bibliography.newspaper",
    Date: "bibliography.date",
    PublicationNumber: "bibliography.publication",
    PageNumber: "bibliography.page",
    PageLocation: "bibliography.location",
    HeadlineSize: "bibliography.size.headline",
    ColInch: "bibliography.size.col-inch",
    ArticleSize: "bibliography.size.article",
    Link: "bibliography.size.file",
    Photograph: "bibliography.photo",
    NewsType: "bibliography.type",
    NewsTopic: "categories.focus.topic",
    GeoLevel: "categories.focus.level",
    GeoMainName: "categories.place.geo",
    Longitude: "categories.place.longitude",
    Latitude: "categories.place.latitude",
    InOrOutdoor: "categories.place.type",
    PublicOrPrivate: "categories.place.space",
    CentralOrSuburb: "categories.place.density",
    GeoSubName: "categories.place.specific",
    Cat1: "categories.happenings[0] ? 'Applicable' : 'Not Applicable'",
    Cat1_ShortAbstract: "categories.happenings[0].name",
    Cat1_ExternalFactor: "categories.happenings[0].external-factor",
    Cat1_GeoNameCity: "categories.happenings[0].place",
    Cat1_GeoNamePlaceSpecific: "categories.happenings[0].place-specific",
    Cat1_Season: "categories.happenings[0].time.season",
    Cat1_Year: "categories.happenings[0].time.year",
    Cat1_Month: "categories.happenings[0].time.month",
    Cat1_Day: "categories.happenings[0].time.day",
    Cat1_Period: "categories.happenings[0].time.period",
    Cat2: "categories.happenings[1] ? 'Applicable' : 'Not Applicable'",
    Cat2_ShortAbstract: "categories.happenings[1].name",
    Cat2_ExternalFactor: "categories.happenings[1].external-factor",
    Cat2_GeoNameCity: "categories.happenings[1].place",
    Cat2_GeoNamePlaceSpecific: "categories.happenings[1].place-specific",
    Cat2_Season: "categories.happenings[1].time.season",
    Cat2_Year: "categories.happenings[1].time.year",
    Cat2_Month: "categories.happenings[1].time.month",
    Cat2_Day: "categories.happenings[1].time.day",
    Cat2_Period: "categories.happenings[1].time.period",
    PeopleCategory: "categories.people[0] ? 'Applicable' : 'Not Applicable'",
    Pers1_Name: "categories.people[0].name",
    Pers1_CentralOrSuburb: "categories.people[0].density",
    Pers1_GeoNameCity: "categories.people[0].place",
    Pers1_GeoNamePlaceSpecific: "categories.people[0].place-specific",
    Pers1_WorkType: "categories.people[0].work-type",
    Pers1_EducationLevel: "categories.people[0].education-level",
    Pers1_FieldOfExpertise: "categories.people[0].field",
    Pers1_WorkSpecific: "categories.people[0].work-specific",
    Pers1_Company: "categories.people[0].company",
    Pers1_Gender: "categories.people[0].gender",
    Pers1_Age: "categories.people[0].age",
    Pers1_AgeSpecific: "categories.people[0].age-specific",
    Pers1_Role: "categories.people[0].role",
    Pers1_Action: "categories.people[0].action",
    Pers2_Name: "categories.people[1].name",
    Pers2_CentralOrSuburb: "categories.people[1].density",
    Pers2_GeoNameCity: "categories.people[1].place",
    Pers2_GeoNamePlaceSpecific: "categories.people[1].place-specific",
    Pers2_WorkType: "categories.people[1].work-type",
    Pers2_EducationLevel: "categories.people[1].education-level",
    Pers2_FieldOfExpertise: "categories.people[1].field",
    Pers2_WorkSpecific: "categories.people[1].work-specific",
    Pers2_Company: "categories.people[1].company",
    Pers2_Gender: "categories.people[1].gender",
    Pers2_Age: "categories.people[1].age",
    Pers2_AgeSpecific: "categories.people[1].age-specific",
    Pers2_Role: "categories.people[1].role",
    Pers2_Action: "categories.people[1].action",
    Pers3_Name: "categories.people[2].name",
    Pers3_CentralOrSuburb: "categories.people[2].density",
    Pers3_GeoNameCity: "categories.people[2].place",
    Pers3_GeoNamePlaceSpecific: "categories.people[2].place-specific",
    Pers3_WorkType: "categories.people[2].work-type",
    Pers3_EducationLevel: "categories.people[2].education-level",
    Pers3_FieldOfExpertise: "categories.people[2].field",
    Pers3_WorkSpecific: "categories.people[2].work-specific",
    Pers3_Company: "categories.people[2].company",
    Pers3_Gender: "categories.people[2].gender",
    Pers3_Age: "categories.people[2].age",
    Pers3_AgeSpecific: "categories.people[2].age-specific",
    Pers3_Role: "categories.people[2].role",
    Pers3_Action: "categories.people[2].action",
    OrganizationsCategory: "categories.organizations[0] ? 'Applicable' : 'Not Applicable'",
    Organization1: "categories.organizations[0].name",
    Organization2: "categories.organizations[1].name",
    Organization3: "categories.organizations[2].name",
    ProductCategory: "categories.products[0] ? 'Applicable' : 'Not Applicable'",
    ProductKind: "categories.products[0].kind",
    Personal_head: "categories.products[0].target",
    Personal_Body: "categories.products[0].target",
    Personal_ProductKind: "categories.products[0].kind",
    Cleaning_InHouse: "categories.products[0].kind",
    "unknown-column": "categories.products[0]",
    DetergentFunction: "categories.products[0].function",
    DetergentForm: "categories.products[0].form",
    Product_Specific: "categories.products[0].specific",
    Target_gender: "categories.products[0].target-gender",
    Target_age: "categories.products[0].target-age",
    Topic1: "categories.topics[0]",
    Topic2: "categories.topics[1]",
    Topic3: "categories.topics[2]",
    Comments: "comments",
    Text: "article.text",
    Abstract: "article.abstract",
    Keywords: "article.keywords",
};

function isAuthenticated(req) {
    return req.session && req.session.userId ? true : false;
}

function isAdmin(req) {
    return req.session && req.session.admin ? true : false;
}

function defineRoutes() {

    app.get('/login', function(req, res) {
        res.render('login.ejs', {
            title: "Login",
            username: "",
            redirect: req.query.redirect,
            queryNames:queryNames,
            fieldNames:fieldNames,
            authenticated: isAuthenticated(req)
        });
    })

    app.post('/login', function(req, res) {
        if (req.body.username && req.body.password) {
            db.collection('users').findOne({username:req.body.username}, (err, user) => {
                if (err) return console.log(err);
                if (user) {
                    bcrypt.compare(req.body.password, user.password, (err, result) => {
                        console.log(result)
                        if (result === true) {
                            console.log(req.session);
                            req.session.userId = user._id;
                            req.session.admin = user.admin;
                            return res.redirect(req.body.redirect || "/");
                        }
                        else {
                            // Password mismatch
                            return res.redirect('/login');
                        }
                    });
                }
                else {
                    // User not found
                    return res.redirect('/login');
                }
            });
        }
        else {
            return res.redirect('/login');
        }
    })

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
                username: "",
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

    app.post('/training/upload', function(req, res) {
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
            
            drive.createOrUpdateFile(auth, files.file.name, 'application/pdf', fs.createReadStream(files.file.path), [id])
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
                authenticated: true
            });
        });
    });

    app.get('/training/list', function(req, res) {
        
        db.collection('trainingdb').find(req.session.admin ? {} : {userId: req.session.userId}).toArray((err, result) => {
            if (err) return console.log(err);
            if (req.query.csv) {
                exportCsv(csvTemplate, result, res);
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
    });

    // Everything from hereon needs admin
    app.get('/', function(req, res) {
        db.collection('thaidb').find().toArray((err, result) => {
            if (err) return console.log(err);
            res.render('index.ejs', {
                articles:result, 
                title:"All",
                queryNames:queryNames,
                fieldNames:fieldNames,
                authenticated: true
            });
        });
    })

    app.get('/article/:id', function(req, res) {
        db.collection('thaidb').findOne({id: req.params.id}, (err, result) => {
            if (err) return console.log(err);
            res.send(result);
        });
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
                exportCsv(csvTemplate, result, res);
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

    app.get('/new', function(req, res) {
        res.render('new.ejs', {
            data:{},
            queryNames:queryNames,
            fieldNames:fieldNames,
            authenticated: true
        });
    });

    app.get('/edit/:id', function(req, res) {
        db.collection('thaidb').findOne({id: req.params.id}, (err, result) => {
            if (err) return console.log(err);
            res.render('new.ejs', {
                data:result,
                queryNames:queryNames,
                fieldNames:fieldNames,
                authenticated: true
            });
        });
    });

}