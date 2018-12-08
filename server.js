const express = require('express');
const bodyParser= require('body-parser')
const mongodb = require('mongodb');
const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('resources'))

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

const map = {
    newspaper: "$bibliography.newspaper",
    geo: "$categories.place.geo",
    "external-factor": "$categories.happening.external-factor",
    density: "$categories.place.density",
    topic: "$categories.topics",
    keyword: "$article.keywords",
    product: "$categories.product.kind",
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

app.get('/search', function(req, res) {
    db.collection('thaidb').find({ $text: { $search: req.query.query } }, {"article.abstract":1, _id:1}).toArray((err, result) => {
        if (err) return console.log(err);
        result.sort();
        res.render('index.ejs', {articles:result, attribute:req.params.name, title:req.params.name});
    });
})

app.get('/count/:name', function(req, res) {
    let group = map[req.params.name];
    let aggregate = [];
    if (group.startsWith("$categories.happening")) {
        aggregate.push({$unwind:"$categories.happening"});
    }
    if (group == "$categories.topics") {
        aggregate.push({$unwind:"$categories.topics"});
    }
    if (group == "$article.keywords") {
        aggregate.push({$unwind:"$article.keywords"});
    }
    aggregate.push({$sortByCount:group});
    console.log(group, aggregate);
    db.collection('thaidb').aggregate(aggregate).toArray((err, result) => {
        if (err) return console.log(err)
        result = result.filter(article => article._id != "");
        let articles = result.map(article => ({name:article._id, count:article.count}));
        let count = result.map(article => article.count);
        res.render('external-factor.ejs', {articles:articles, count:count});
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
    if (firstGroup == "$article.keywords" || secondGroup == "$article.keywords") {
        aggregate.push({$unwind:"$article.keywords"});
    }
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
            console.log(articles, labels, categories, datasets);

            res.render('group.ejs', {articles:articles, count:count, first:req.params.first, second:req.params.second, 
                labels:labels, categories:categories, datasets:datasets});
            }
    });
})

app.get('/group/:first/:second/:valueFirst/:valueSecond', function(req, res) {
    let nameFirst = map[req.params.first].slice(1);
    let nameSecond = map[req.params.second].slice(1);
    db.collection('thaidb').find({[nameFirst]: req.params.valueFirst, [nameSecond]: req.params.valueSecond}).toArray((err, result) => {
        if (err) return console.log(err);
        res.render('index.ejs', {articles:result, title:`${req.params.first}:${req.params.valueFirst} - ${req.params.second}:${req.params.valueSecond}`});
    });
});