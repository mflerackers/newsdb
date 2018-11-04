const fs = require('fs');
const parse = require('csv-parse/lib/sync')
const assert = require('assert')

module.exports = {};

module.exports = function(path) {
    let contents = fs.readFileSync(path, "utf8");
    //console.log(contents);
    const records = parse(contents, {
        //columns: true,
        skip_empty_lines: true
    });
    console.log(records[0].length);

    json = records.map(record => { return {
        "id":                           record[0],
        "relevance":                    record[1],
        "bibliography": {           
            "headline":                 record[2],
            "newspaper":                record[3],
            "date":                     record[4],
            "publication":              record[5],
            "page":                     record[6],
            "location":                 record[7],
            "size": {           
                "headline":             record[8],
                "article":              record[9],
            },          
            "photo":                    record[10],
            "type":                     record[11]
        },          
        "categories": {         
            "focus": {          
                "topic":                record[12],
                "level":                record[13]
            },          
            "place": {          
                "geo":                  record[14],
                "longitude":            record[15],
                "latitude" :            record[16],
                "type":                 record[17],
                "space":                record[18],
                "density":              record[19],
                "specific":             record[20]
            },          
            "happening":[
                {                       // record[21],
                    "name":             record[22],
                    "external-factor":  record[23],
                    "place":            record[24],
                    "place-specific":   record[25],
                    "time":{
                        "season":       record[26],
                        "year":         record[27],
                        "month":        record[28],
                        "day":          record[29],
                        "period":       record[30]
                    }
                },
                {                       // record[31],
                    "name":             record[32],
                    "external-factor":  record[33],
                    "place":            record[34],
                    "place-specific":   record[35],
                    "time":{
                        "season":       record[36],
                        "year":         record[37],
                        "month":        record[38],
                        "day":          record[39],
                        "period":       record[40]
                    }
                }
            ], 
            "people":[                  // record[41],
                {
                    "name":             record[42],
                    "density":          record[43],
                    "place":            record[44],
                    "place-specific":   record[45],
                    "work-type":        record[46],
                    "education-level":  record[47],
                    "field":            record[48],
                    "work-specific":    record[49],
                    "gender":           record[50],
                    "age":              record[51],
                    "age-specific":     record[52],
                    "role":             record[53]
                },
                {
                    "name":             record[54],
                    "density":          record[55],
                    "place":            record[56],
                    "place-specific":   record[57],
                    "work-type":        record[58],
                    "education-level":  record[59],
                    "field":            record[60],
                    "work-specific":    record[61],
                    "gender":           record[62],
                    "age":              record[63],
                    "age-specific":     record[64],
                    "role":             record[65]
                },
                {
                    "name":             record[66],
                    "density":          record[67],
                    "place":            record[68],
                    "place-specific":   record[69],
                    "work-type":        record[70],
                    "education-level":  record[71],
                    "field":            record[72],
                    "work-specific":    record[73],
                    "gender":           record[74],
                    "age":              record[75],
                    "age-specific":     record[76],
                    "role":             record[77]
                }
            ],
            "organizations":[           // record[78],
                {
                    "name":             record[79],
                    "person":           record[80].indexOf("person ") != -1 ? record[80].split(" ")[1].split(",").map(i => Number(i)) : [],
                },
                {
                    "name":             record[81],
                    "person":           record[82].indexOf("person ") != -1 ? record[82].split(" ")[1].split(",").map(i => Number(i)) : [],
                },
                {
                    "name":             record[83],
                    "person":           record[84].indexOf("person ") != -1 ? record[84].split(" ")[1].split(",").map(i => Number(i)) : [],
                }
            ],
            "other-organization":       record[85],
            "product": {                // record[86],
                "kind":                 record[87],
                "hygiene": {
                    "head":             record[88],
                    "body":             record[89],
                    "kind":             record[90]
                },
                "cleaning": {
                    "target":           record[91],
                    "function":         record[92],
                    "form":             record[93],
                },
                "specific":             record[94],
                "target-gender":        record[95],
                "target-age":           record[96]
            },
            "topics": [
                record[97], 
                record[98], 
                record[99]
            ].filter(topic => topic != "NA" && topic != "")
        },
        "comments":                     record[100],
        "article": {            
            "text":                     record[101],
            "abstract":                 record[102],
            "keywords":                 record[103].split(",").map(keyword => keyword.trim())
        }
    }});

    //console.log(JSON.stringify(json, null, 4));

    //let keywords = {};
    //let topics = {};

    records.forEach((record, i) => {
        if (record[21] == "Not Applicable" && record.slice(22, 31).some(field => field != "NA")) {
            console.log(`${record[0]} Happening 1 is set to 'Not Applicable' but not all fields are 'NA'`);
            console.log(record.slice(21, 31));
        }
        if (record[31] == "Not Applicable" && record.slice(32, 41).some(field => field != "NA")) {
            console.log(`${record[0]} Happening 2 is set to 'Not Applicable' but not all fields are 'NA'`);
            console.log(record.slice(31, 41));
        }
        if (record[41] == "Not Applicable" && record.slice(42, 78).some(field => field != "NA")) {
            console.log(`${record[0]} People is set to 'Not Applicable' but not all fields are 'NA'`);
            console.log(record.slice(41, 78));
        }
        if (record[78] == "Not Applicable" && record.slice(79, 85).some(field => field != "NA")) {
            console.log(`${record[0]} Organizations is set to 'Not Applicable' but not all fields are 'NA'`);
            console.log(record.slice(78, 85));
        }
        if (record[86] == "Not Applicable" && record.slice(87, 97).some(field => field != "NA")) {
            console.log(`${record[0]} Product is set to 'Not Applicable' but not all fields are 'NA'`);
            console.log(record.slice(86, 97));
        }

        let jsonRecord = json[i];
        jsonRecord.categories.organizations.forEach(organization => {
            organization.person.forEach(index => {
                if (record[41] == "Not Applicable") {
                    console.log(`${record[0]} Person ${index} is used in organization but people are 'Not Applicable'`);
                }
                if (jsonRecord.categories.people[index-1].name == "NA") {
                    console.log(`${record[0]} Person ${index} is used in organization but is 'NA'`);
                }
            });
        });

        /*jsonRecord.article.keywords.forEach(keyword => {
            keyword = keyword.toLowerCase();
            size = jsonRecord.bibliography.size.article;
            keywords[[keyword,size]] = (keywords[[keyword,size]] || 0) + 1;
        });

        jsonRecord.categories.topics.forEach(topic => {
            topic = topic.toLowerCase();
            size = jsonRecord.bibliography.size.article;
            topics[[topic,size]] = (topics[[topic,size]] || 0) + 1;
        });*/
    });

    /*console.log("keywords----------------");
    sortMapByValue(keywords).forEach(pair => console.log(`${pair[0]}: ${pair[1]}`));
    console.log("topics------------------");
    sortMapByValue(topics).forEach(pair => console.log(`${pair[0]}: ${pair[1]}`));

    console.log(`${json.length} records`);*/

    return json;
}