const fs = require('fs');
const parse = require('csv-parse/lib/sync');
const assert = require('assert');
const provinces = require('./provinces');
const districts = require('./districts');

module.exports = {};

function cleanGeo(geo) {
    if (geo == "" || geo == "NA") {
        return undefined;
    }
    // Split on comma
    let parts = geo.split(",");
    // Make all parts lowercase, remove whitespace and remove all empty strings
    parts = parts.map(part => part.toLowerCase().trim()).filter(part => part.length > 0);
    if (parts.length == 0) {
        return undefined;
    }
    /*if (parts.length == 1) {
        return parts[0];
    }
    else*/ {
        geo = {original:geo};

        parts.forEach((part, i) => {

            if (part == "bankok")
                part = "bangkok";

            if (part.includes("province")) {
                geo.province = part.replace(/(\s*province\s*)/, "");
            }
            else if (part.includes("district")) {
                geo.district = part.replace(/(\s*district\s*)/, "");
            } else {
                /*if (i == 0) {
                    geo.city = part;
                }
                else {*/
                    if (!geo.province && provinces.includes(part)) {
                        geo.province = part;
                    }
                    else {
                        geo.country = part;
                    }
                //}
            }
        });

        if (!geo.country && (geo.province || geo.district))
            geo.country = "thailand";

        if (geo.province && !provinces.includes(geo.province)) {
            console.error("unknown province " + geo.province);
        }
        if (geo.district && !(districts.includes(geo.district) || districts.includes(geo.district + " " + geo.province))) {
            console.error("unknown district " + geo.district);
        }

        console.log(geo);

        let geoString = [geo.country,geo.province,geo.district,geo.city].join(",");

        return geoString;
    }
}

function cleanLonLat(lat, lon) {
    if (lon == "NA" || lat == "NA")
        return null;
    lon = +lon;
    lat = +lat;
    if (Math.abs(lat) > 90) {
        [lon, lat] = [lat, lon];
    }
    return {
        type:"Point", 
        coordinates:[lon, lat]
    };
}

module.exports = function(path) {
    let contents = fs.readFileSync(path, "utf8");
    //console.log(contents);
    const records = parse(contents, {
        //columns: true,
        skip_empty_lines: true
    });
    //console.log(records[0].length);

    json = records.map(record => { return {
        "id":                           record[0],
        "geoLocation":                  cleanLonLat(record[17], record[18]),
        "relevance":                    record[1],
        "bibliography": {           
            "headline":                 record[2],
            "newspaper":                record[3].toLowerCase(),
            "date":                     record[4],
            "publication":              record[5],
            "page":                     record[6],
            "location":                 record[7],
            "size": {           
                "headline":             record[8],
                "col-inch":             record[9],
                "article":              record[10],
            },          
            "file":                     record[11],
            "photo":                    record[12],
            "type":                     record[13]
        },          
        "categories": {         
            "focus": {          
                "topic":                record[14],
                "level":                record[15]
            },          
            "place": {          
                "geo":                  cleanGeo(record[16]),
                "longitude":            record[17],
                "latitude" :            record[18],
                "type":                 record[19],
                "space":                record[20],
                "density":              record[21],
                "specific":             record[22]
            },          
            "happening":[
                {                       // record[23],
                    "name":             record[24],
                    "external-factor":  record[25],
                    "place":            record[26],
                    "place-specific":   record[27],
                    "time":{
                        "season":       record[28],
                        "year":         record[29],
                        "month":        record[30],
                        "day":          record[31],
                        "period":       record[32]
                    }
                },
                {                       // record[33],
                    "name":             record[34],
                    "external-factor":  record[35],
                    "place":            record[36],
                    "place-specific":   record[37],
                    "time":{
                        "season":       record[38],
                        "year":         record[39],
                        "month":        record[40],
                        "day":          record[41],
                        "period":       record[42]
                    }
                }
            ].filter(happening => happening.name != "NA"),
            "people":[                  // record[43],
                {
                    "name":             record[44],
                    "density":          record[45],
                    "place":            record[46],
                    "place-specific":   record[47],
                    "work-type":        record[48],
                    "education-level":  record[49],
                    "field":            record[50],
                    "work-specific":    record[51],
                    "organization":     record[52],
                    "gender":           record[53],
                    "age":              record[54],
                    "age-specific":     record[55],
                    "role":             record[56],
                    "action":           record[57]
                },
                {
                    "name":             record[58],
                    "density":          record[59],
                    "place":            record[60],
                    "place-specific":   record[61],
                    "work-type":        record[62],
                    "education-level":  record[63],
                    "field":            record[64],
                    "work-specific":    record[65],
                    "organization":     record[66],
                    "gender":           record[67],
                    "age":              record[68],
                    "age-specific":     record[69],
                    "role":             record[70],
                    "action":           record[71]  
                },
                {
                    "name":             record[72],
                    "density":          record[73],
                    "place":            record[74],
                    "place-specific":   record[75],
                    "work-type":        record[76],
                    "education-level":  record[77],
                    "field":            record[78],
                    "work-specific":    record[79],
                    "organization":     record[80],
                    "gender":           record[81],
                    "age":              record[82],
                    "age-specific":     record[83],
                    "role":             record[84],
                    "action":           record[85]
                }
            ],
            "organizations":[           // record[86],
                {
                    "name":             record[87]
                },
                {
                    "name":             record[88]
                },
                {
                    "name":             record[89]
                }
            ].filter(organization => organization != "NA"),
            "product": record[91] != "NA" ? {                // record[90],
                "kind":                 record[91],
                "hygiene": {
                    "head":             record[92],
                    "body":             record[93],
                    "kind":             record[94]
                },
                "cleaning": {
                    "target":           record[95],
                    "function":         record[96],
                    "form":             record[97],
                },
                "product-specific":     record[98],
                "service-specific":     record[99],
                "target-gender":        record[100],
                "target-age":           record[101]
            } : undefined,
            "topics": [
                record[102], 
                record[103], 
                record[104]
            ].filter(topic => topic != "NA" && topic != "")
        },
        "comments":                     record[105],
        "article": {            
            "text":                     record[106],
            "abstract":                 record[107],
            "keywords":                 record[108].split(",").map(keyword => keyword.trim().toLowerCase())
        }
    }});

    //console.log(JSON.stringify(json, null, 4));

    /*json.forEach(record => {
        console.log(JSON.stringify(record, null, 4));
    });*/

    //let keywords = {};
    //let topics = {};

    /*records.forEach((record, i) => {
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
        });
    });*/

    /*console.log("keywords----------------");
    sortMapByValue(keywords).forEach(pair => console.log(`${pair[0]}: ${pair[1]}`));
    console.log("topics------------------");
    sortMapByValue(topics).forEach(pair => console.log(`${pair[0]}: ${pair[1]}`));

    console.log(`${json.length} records`);*/

    return json;
}