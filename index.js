const compiler = require('@vue/component-compiler-utils');
const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const hash = require('hash-sum');
const { JSDOM } = jsdom;
const watch = require('gulp-watch');

let convertFile = function (filepath) {
    let content = fs.readFileSync(filepath).toString();
    let parsed = compiler.parse({ source: content, needMap: false });
    
    let template = parsed.template ? parsed.template.content : '';
    let script = parsed.script ? parsed.script.content : '';
    let style = parsed.styles.length > 0 ? parsed.styles : [];
    let importStatement = getScriptImportStatement(script);
    
    let templateEscaped = template.trim().replace(/`/g, '\\`');
    let scriptEscaped = script.substring(script.indexOf("export default"));
    let dom = new JSDOM(templateEscaped);
    let unique_data_v = 'data-v-' + hash(path.basename(filepath) + content);
    addScopedData(dom.window.document.body.firstChild, unique_data_v);

    templateEscaped = dom.window.document.body.innerHTML;

    //处理style
    let css = '';
    for (let i = 0; i < style.length; i++) {
        let a = compiler.compileStyle({ source: style[i].content, id: unique_data_v, scoped: style[i].scoped == true });
        let code = a.code.replace(/\n/g, '');
        css += code;
    }
    let css_script = '';
    if (style.length > 0) {
        css_script = `
docReady(function(){
    var css = \`${css}\`;
    var head = document.getElementsByTagName('head')[0];
    var style = document.createElement('style');
    style.type = 'text/css';
    if(style.styleSheet){
        style.styleSheet.cssText = css;
    }else{
        style.appendChild(document.createTextNode(css));
    }
    head.appendChild(style);
});\n`; 
    }
    
    
    let scriptWithTemplate = scriptEscaped.replace(/export default ?\{/, `{\n    template:\`${templateEscaped}\`,`);

    let importStatementVar = '';
    for (let i in importStatement) {
        importStatementVar += `var ${i}='';`;
    }
    let script_instance = eval(importStatementVar + '(' + scriptWithTemplate + ')');
    
    let component_name = path.basename(filepath, '.vue');
    if (script_instance.name) {
        component_name = script_instance.name;
    }
    
    let final_js = `var ${component_name}=${scriptWithTemplate};\n`;
    //return { name: component_name, imports: importStatement };
    return { name: component_name, js: final_js + css_script, imports: importStatement };
};


let addScopedData = function (node, scopedId) {
    if (!node.setAttribute) return;
    node.setAttribute(scopedId, '');
    for (let i = 0; i < node.childNodes.length; i++) {
        addScopedData(node.childNodes[i], scopedId);
    }
};

let getScriptImportStatement = function (script) {
    let group = script.match(/import (.*) from (.*);/ig);
    let importStatement = {};
    if (group == null) return {};
    for (var item of group) {
        let name = item.replace(/(import )(.*)( from )(.*);/, '$2');
        let filepath = item.replace(/(import )(.*)( from )[\'"](.*)[\'"];/, '$4');
        importStatement[name] = filepath;
        //importStatement+='var '+item.replace(/(import )(.*)( from )(.*);/, '$2')+'="";';
    }
    return importStatement;
};

let main = function () {
    let file = process.argv[2];
    let output = process.argv[3];
    //let stat = fs.lstatSync(file);
    let new_content = `
(function(funcName, baseObj) {
    // The public function name defaults to window.docReady
    // but you can pass in your own object and own function name and those will be used
    // if you want to put them in a different namespace
    funcName = funcName || "docReady";
    baseObj = baseObj || window;
    var readyList = [];
    var readyFired = false;
    var readyEventHandlersInstalled = false;

    // call this when the document is ready
    // this function protects itself against being called more than once
    function ready() {
        if (!readyFired) {
            // this must be set to true before we start calling callbacks
            readyFired = true;
            for (var i = 0; i < readyList.length; i++) {
                // if a callback here happens to add new ready handlers,
                // the docReady() function will see that it already fired
                // and will schedule the callback to run right after
                // this event loop finishes so all handlers will still execute
                // in order and no new ones will be added to the readyList
                // while we are processing the list
                readyList[i].fn.call(window, readyList[i].ctx);
            }
            // allow any closures held by these functions to free
            readyList = [];
        }
    }

    function readyStateChange() {
        if ( document.readyState === "complete" ) {
            ready();
        }
    }

    // This is the one public interface
    // docReady(fn, context);
    // the context argument is optional - if present, it will be passed
    // as an argument to the callback
    baseObj[funcName] = function(callback, context) {
        if (typeof callback !== "function") {
            throw new TypeError("callback for docReady(fn) must be a function");
        }
        // if ready has already fired, then just schedule the callback
        // to fire asynchronously, but right away
        if (readyFired) {
            setTimeout(function() {callback(context);}, 1);
            return;
        } else {
            // add the function and context to the list
            readyList.push({fn: callback, ctx: context});
        }
        // if document already ready to go, schedule the ready function to run
        if (document.readyState === "complete") {
            setTimeout(ready, 1);
        } else if (!readyEventHandlersInstalled) {
            // otherwise if we don't have event handlers installed, install them
            if (document.addEventListener) {
                // first choice is DOMContentLoaded event
                document.addEventListener("DOMContentLoaded", ready, false);
                // backup is window load event
                window.addEventListener("load", ready, false);
            } else {
                // must be IE
                document.attachEvent("onreadystatechange", readyStateChange);
                window.attachEvent("onload", ready);
            }
            readyEventHandlersInstalled = true;
        }
    }
})("docReady", window);\n`; 
    let component_list = [];
    let import_list_use_count = [];
    //new_content += iteratorFile(file);
    iteratorFile(file, component_list);
    for (let key in component_list) {
        if (import_list_use_count[key] == undefined) {
            import_list_use_count[key] = 0; 
        }
        for (let c in component_list[key].imports) {
            if (import_list_use_count[c] == undefined ) {
                import_list_use_count[c] = 1; 
            } else {
                import_list_use_count[c]++; 
            }
        }
    }
    //console.log(component_list);
    let sorted_import_list = [];
    for (let i in import_list_use_count) {
        sorted_import_list.push({ name: i, count: import_list_use_count[i] });
    }
    //按照被import次数降序
    for (let i = 0; i < sorted_import_list.length; i++) {
        for (let j = i+1; j < sorted_import_list.length; j++) {
            if (sorted_import_list[i].count < sorted_import_list[j].count) {
                let tmp = sorted_import_list[i];
                sorted_import_list[i] = sorted_import_list[j];
                sorted_import_list[j] = tmp;
            }
        }
    }
    for (let item of sorted_import_list) {
        if (component_list[item.name] != undefined) {
            new_content += component_list[item.name].js; 
        }
    }
    fs.writeFileSync(path.resolve(output), new_content);
    console.log("编译完成\n");
}

let iteratorFile = function (file, component_list) {
    let stat = fs.lstatSync(file);
    let new_content = '';
    if (stat.isDirectory()) {
        let files = fs.readdirSync(file);
        for (let i = 0; i < files.length; i++) {
            let new_file = path.resolve(path.join(file, files[i]));
            iteratorFile(new_file, component_list);
            //new_content += iteratorFile(new_file);
        }
        //return new_content;
    } else {
        console.log(file);
        let c = convertFile(file);
        component_list[c.name] = c;
        //return convertFile(file);
    }
}


main();

if (process.argv[4] == '--watch') {
    let watch_path = process.argv[2];
    let stat=fs.lstatSync(watch_path);
    if (stat.isDirectory()) {
        watch_path = path.join(watch_path,'/**/**.vue');
    }
    watch(watch_path, function () {
        main(); 
    }); 
}