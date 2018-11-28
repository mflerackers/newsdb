const express = require('express');
const bodyParser= require('body-parser')
const mongodb = require('mongodb');
const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));

var db

mongodb.connect('mongodb://localhost:27017', (err, client) => {
  if (err) return console.log(err)
  db = client.db('thaidb')
  app.listen(3000, () => {
    console.log('listening on 3000')
  })
})

app.get('/', function(req, res) {
    db.collection('thaidb').find().toArray((err, result) => {
        if (err) return console.log(err);
        res.render('index.ejs', {articles:result, title:"All"});
    });
})

app.get('/article/:id', function(req, res) {
    db.collection('thaidb').findOne({id: req.params.id}, (err, result) => {
        if (err) return console.log(err);
        res.send(result);
    });
})

app.get('/newspaper/', function(req, res) {
    db.collection('thaidb').distinct("bibliography.newspaper", (err, result) => {
        if (err) return console.log(err);
        res.render('newspaper.ejs', {articles:result});
    });
})

app.get('/newspaper/:name', function(req, res) {
    db.collection('thaidb').find({"bibliography.newspaper": req.params.name}).toArray((err, result) => {
        if (err) return console.log(err);
        res.render('index.ejs', {articles:result, title:`Newspaper - ${req.params.name}`});
    });
})

app.get('/geo', function(req, res) {
    db.collection('thaidb').distinct("categories.place.geo", (err, result) => {
        if (err) return console.log(err);
        result.sort();
        res.render('geo.ejs', {articles:result});
    });
})

app.get('/geo/:name', function(req, res) {
    db.collection('thaidb').find({"categories.place.geo": req.params.name}).toArray((err, result) => {
        if (err) return console.log(err);
        res.render('index.ejs', {articles:result, title:`Geo - ${req.params.name}`});
    });
})

const map = {
    geo: "$categories.place.geo",
    "external-factor": "$categories.happening.external-factor",
    density: "$categories.place.density",
    topic: "$categories.topics"
};

app.get('/list/:name', function(req, res) {
    let name = map[req.params.name].slice(1);
    db.collection('thaidb').distinct(name, (err, result) => {
        if (err) return console.log(err);
        result.sort();
        res.render('list.ejs', {articles:result, attribute:req.params.name, title:req.params.name});
    });
})

app.get('/list/:name/:value', function(req, res) {
    let name = map[req.params.name].slice(1);
    db.collection('thaidb').find({[name]: req.params.value}).toArray((err, result) => {
        if (err) return console.log(err);
        res.render('index.ejs', {articles:result, title:`${req.params.name} - ${req.params.value}`});
    });
})

app.get('/external-factor/', function(req, res) {
    if (req.query.chart) {
        db.collection('thaidb').aggregate([
            {$unwind:"$categories.happening"},
            {$sortByCount:"$categories.happening.external-factor"}]).toArray((err, result) => {
            if (err) return console.log(err)
            result = result.filter(article => article._id != "");
            let articles = result.map(article => article._id);
            let count = result.map(article => article.count);
            res.render('external-factor.ejs', {articles:articles, count:count});
        });
    }
    else {
        db.collection('thaidb').distinct("categories.happening.external-factor", (err, result) => {
            if (err) return console.log(err);
            result = result.filter(article => article != "");
            result.sort();
            res.render('external-factor.ejs', {articles:result, count:false});
        });
    }
})

app.get('/external-factor/:name', function(req, res) {
    db.collection('thaidb').find({"categories.happening.external-factor": req.params.name}).toArray((err, result) => {
        if (err) return console.log(err);
        res.render('index.ejs', {articles:result, title:`External Factor - ${req.params.name}`});
    });
})

app.get('/group/:first/:second', function(req, res) {
    let firstGroup = map[req.params.first];
    let secondGroup = map[req.params.second];
    let aggregate = [];
    if (firstGroup.startsWith("$categories.happening") || secondGroup.startsWith("$categories.happening")) {
        aggregate.push({$unwind:"$categories.happening"});
    }
    if (firstGroup == "$categories.topics" || secondGroup == "$categories.topics") {
        aggregate.push({$unwind:"$categories.topics"});
    }
    aggregate.push({$sortByCount:{$mergeObjects:{first:firstGroup,second:secondGroup}}});
    console.log(firstGroup, secondGroup, aggregate);
    db.collection('thaidb').aggregate(aggregate).toArray((err, result) => {
        if (err) return console.log(err)
        result = result.filter(article => article._id.first && article._id.first != "" && article._id.second && article._id.second != "");
        let articles = result.map(article => [article._id.first, article._id.second, article.count].join(","));
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
        result.forEach(r => {
            category = r._id.second;
            if (categories.findIndex(c => c == category) == -1)
                categories.push(category);
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
        console.log(labels, categories, datasets);

        res.render('group.ejs', {articles:articles, count:count, first:req.params.first, second:req.params.second, 
            labels:labels, categories:categories, datasets:datasets});
    });
})