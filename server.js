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
    province: "$categories.place.province",
};

app.get('/list/:name', function(req, res) {
    let name = map[req.params.name].slice(1);
    db.collection('thaidb').distinct(name, (err, result) => {
        if (err) return console.log(err);
        result = result.filter(article => article && article._id != "");
        result.sort();
        res.render('list.ejs', {articles:result, attribute:req.params.name, title:`Distinct ${req.params.name}`});
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
        result = result.filter(article => article._id && article._id != "");
        let articles = result.map(article => ({name:article._id, count:article.count}));
        let count = result.map(article => article.count);
        res.render('count.ejs', {articles:articles, count:count, attribute:req.params.name, title:`Count by ${req.params.name}`});
    });
})

app.get('/group/:first/:second', function(req, res) {
    let firstGroup = map[req.params.first];
    let secondGroup = map[req.params.second];
    let aggregate = [];
    if ([firstGroup, secondGroup].some(name => name.startsWith("$categories.happening"))) {
        aggregate.push({$unwind:"$categories.happening"});
    }
    if ([firstGroup, secondGroup].some(name => name.startsWith("$categories.topics"))) {
        aggregate.push({$unwind:"$categories.topics"});
    }
    if ([firstGroup, secondGroup].some(name => name.startsWith("$article.keywords"))) {
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
        [req.params.first, req.params.second].forEach(param => {
            let count = {}
            result[param].forEach(record => {
                if (data[record._id.group]) {
                    if (data[record._id.group][param]) {
                        data[record._id.group][param][record._id.param] = record.count;
                    }
                    else {
                        data[record._id.group][param] = {
                            [record._id.param]: record.count
                        }
                    }
                }
                else {
                    data[record._id.group] = {
                        [param]:{
                            [record._id.param]: record.count
                        }
                    };
                }
                count[record._id.group] = (count[record._id.group] || 0) + record.count;
            });
            Object.entries(data).forEach(([group, map]) => {
                let sum = count[group];
                Object.entries(map[param]).forEach(([key, count]) => {
                    map[param][key] = count / sum;
                });
            });
        });
        res.status(200).send(data);
        //res.render('index.ejs', {articles:result, title:`${req.params.first}:${req.params.valueFirst} - ${req.params.second}:${req.params.valueSecond}`});
    });
});

app.get('/map/:param/:value', function(req, res) {
    let group = map[req.params.param];
    let aggregate = [];
    if ([group].some(name => name.startsWith("$categories.happening"))) {
        aggregate.push({$unwind:"$categories.happening"});
    }
    if ([group].some(name => name.startsWith("$categories.topics"))) {
        aggregate.push({$unwind:"$categories.topics"});
    }
    if ([group].some(name => name.startsWith("$article.keywords"))) {
        aggregate.push({$unwind:"$article.keywords"});
    }
    aggregate.push({$match:{[group.slice(1)]:req.params.value}});
    aggregate.push({$sortByCount:map["geo"]});
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
        res.render('map.ejs', {articles:data, attribute:req.params.param, value:req.params.value , title:`Map where ${req.params.param} is ${req.params.value}`});
        //res.status(200).send(result);
    });
});