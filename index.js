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
        let css_script = `
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
    let script_instance = eval('(' + scriptWithTemplate + ')');
    let component_name = path.basename(filepath, '.vue');
    if (script_instance.name) {
        component_name = script_instance.name;
    }
    
    let final_js = `var ${component_name}=${scriptWithTemplate};\n`;
    return final_js + css_script;
};


let addScopedData = function (node, scopedId) {
    if (!node.setAttribute) return;
    node.setAttribute(scopedId, '');
    for (let i = 0; i < node.childNodes.length; i++) {
        addScopedData(node.childNodes[i], scopedId);
    }
};

let main = function () {
    let file = process.argv[2];
    let output = process.argv[3];
    let stat = fs.lstatSync(file);
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
    if (stat.isDirectory()) {
        let files = fs.readdirSync(file);
        for (let i = 0; i < files.length; i++) {
            let new_file = path.resolve(path.join(file, files[i]));
            stat = fs.lstatSync(path.resolve(path.join(file, files[i])));
            if (stat.isFile()) {
                new_content += convertFile(new_file);
            }
        }
        console.log(files);
    } else {
        new_content = convertFile(file);
    }
    fs.writeFileSync(path.resolve(output), new_content);
    console.log("编译完成\n");
}



main();

if (process.argv[4] == '--watch') {
    let watch_path = process.argv[2];
    let stat=fs.lstatSync(watch_path);
    if (stat.isDirectory()) {
        watch_path = path.join(watch_path,'/**.vue');
    }
    watch(watch_path, function () {
        main(); 
    }); 
}