#!/usr/bin/env node

var raml = require('raml-parser');
var handlebars = require('handlebars');
var marked = require('marked');

function parseBaseUri(ramlObj) {
    // I have no clue what kind of variables the RAML spec allows in the baseUri.
    // For now keep it super super simple.
    if (ramlObj.baseUri){
        ramlObj.baseUri = ramlObj.baseUri.replace('{version}', ramlObj.version);
    }
    return ramlObj;
}

function makeUniqueId(resource) {
    var fullUrl = resource.parentUrl + resource.relativeUri;
    return fullUrl.replace(/[\{\}\/}]/g, '_');
}

function traverse(ramlObj, parentUrl, allUriParameters) {
    var resource, index;
    for (index in ramlObj.resources) {
        resource = ramlObj.resources[index];
        resource.parentUrl = parentUrl || '';
        resource.uniqueId = makeUniqueId(resource);
        resource.allUriParameters = [];

        if (allUriParameters) {
            resource.allUriParameters.push.apply(resource.allUriParameters, allUriParameters);
        }

        if (resource.uriParameters) {
            var key;
            for (key in resource.uriParameters) {
                resource.allUriParameters.push(resource.uriParameters[key]);
            }
        }

        traverse(resource, resource.parentUrl + resource.relativeUri, resource.allUriParameters);
    }

    return ramlObj;
}

function markDownHelper(text) {
    if (text && text.length) {
        return new handlebars.SafeString(marked(text));
    } else {
        return '';
    }
}

function parseWithConfig(source, config, onSuccess, onError) {
    raml.loadFile(source).then(function(ramlObj) {
        ramlObj = parseBaseUri(ramlObj);
        ramlObj = traverse(ramlObj);

        // Register handlebar helpers
        for (var helperName in config.helpers) {
            handlebars.registerHelper(helperName, config.helpers[helperName]);
        }

        // Register handlebar partials
        for (var partialName in config.partials) {
            handlebars.registerPartial(partialName, config.partials[partialName]);
        }

        var result = config.template(ramlObj);
        onSuccess(result);
    }, onError);
}

function parse(source, onSuccess, onError) {
    var template = require('./template.handlebars');
    var resourceTemplate = require('./resource.handlebars');

    var config = {
         'template': template,
         'helpers': {
             'md': markDownHelper
         },
         'partials': {
             'resource': resourceTemplate
         }
     };

    parseWithConfig(source, config, onSuccess, onError);
}

if (require.main === module) {
    var args = process.argv.slice(2);

    if (args.length !== 1) {
        console.error('You need to specify exactly one argument!');
        process.exit(1);
    }

    // Start the parsing process
    parse(args[0], function(result) {
        // For now simply output to console
        process.stdout.write(result);
        process.exit(0);
    }, function(error) {
        console.log('Error parsing: ' + error);
        process.exit(1);
    });
}

module.exports.parse = parse;
module.exports.parseWithConfig = parseWithConfig;
