const express = require('express');
const bodyParser= require('body-parser')
const mongodb = require('mongodb');
const app = express();
const stats = require("./stats")
const fieldNames = require("./field_names")

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('resources'))

var db

mongodb.connect('mongodb://localhost:27017', { 
    useNewUrlParser: true,
    reconnectTries: Number.MAX_VALUE,
    reconnectInterval: 1000 
  }, (err, client) => {
  if (err) return console.log(err)
  db = client.db('thaidb')
  app.listen(3000, () => {
    console.log('listening on 3000')
  })
})

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

app.get('/', function(req, res) {
    db.collection('thaidb').find().toArray((err, result) => {
        if (err) return console.log(err);
        res.render('index.ejs', {
            articles:result, 
            title:"All",
            queryNames:queryNames,
            fieldNames:fieldNames
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
            fieldNames:fieldNames
        });
    });
})

app.get('/list/:name/:value', function(req, res) {
    let name = req.params.name;
    let aggregate = [];
    if (name.startsWith("categories.happening")) {
        aggregate.push({$unwind:"$categories.happening"});
    }
    if (name == "categories.topics") {
        aggregate.push({$unwind:"$categories.topics"});
    }
    if (name == "article.keywords") {
        aggregate.push({$unwind:"$article.keywords"});
    }
    aggregate.push({$match:{[name]: req.params.value}});
    console.log(name, req.params.value, aggregate);
    db.collection('thaidb').aggregate(aggregate).toArray((err, result) => {
    //db.collection('thaidb').find({[name]: req.params.value}).toArray((err, result) => {
        if (err) return console.log(err);
        result = result.filter(article => article && article._id != "");
        res.render('index.ejs', {
            articles:result, 
            title:`${req.params.name} - ${req.params.value}`,
            queryNames:queryNames,
            fieldNames:fieldNames
        });
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
            fieldNames:fieldNames
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
        res.render('count.ejs', {
            articles:articles, 
            count:count, 
            attribute:req.params.name, 
            title:`Count by ${req.params.name}`, 
            statistics:statistics,
            queryNames:queryNames,
            fieldNames:fieldNames
        });
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
                fieldNames:fieldNames
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
            fieldNames:fieldNames
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
            fieldNames:fieldNames
        });
        //res.status(200).send(result);
    });
});

app.get('/new', function(req, res) {
    res.render('new.ejs', {
        data:{},
        queryNames:queryNames,
        fieldNames:fieldNames
    });
});

app.get('/edit/:id', function(req, res) {
    db.collection('thaidb').findOne({id: req.params.id}, (err, result) => {
        if (err) return console.log(err);
        res.render('new.ejs', {
            data:result,
            queryNames:queryNames,
            fieldNames:fieldNames
        });
    });
});