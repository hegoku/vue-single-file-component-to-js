const convertFile = require('./convertFile');
const fs = require('fs');
const path = require('path');
const layout = require('./layout');
const watch = require('gulp-watch');

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
    // let sorted_import_list = [];
    // for (let i in import_list_use_count) {
    //     sorted_import_list.push({ name: i, count: import_list_use_count[i] });
    // }
    // //按照被import次数降序
    // for (let i = 0; i < sorted_import_list.length; i++) {
    //     for (let j = i+1; j < sorted_import_list.length; j++) {
    //         if (sorted_import_list[i].count < sorted_import_list[j].count) {
    //             let tmp = sorted_import_list[i];
    //             sorted_import_list[i] = sorted_import_list[j];
    //             sorted_import_list[j] = tmp;
    //         }
    //     }
    // }
    // for (let item of sorted_import_list) {
    //     if (component_list[item.name] != undefined) {
    //         new_content += component_list[item.name].js; 
    //     }
    // }
    let import_layout = new layout();
    let level0_import = [];
    for (let i in import_list_use_count) {
        if (import_list_use_count[i] != 0) continue;
        if (component_list[i] == undefined) continue;
        level0_import[i] = '';
    }
    iteratorImport(0, level0_import, component_list, import_layout);
    let final_layout = import_layout.data.reverse();
    for (let i of final_layout) {
        for (let j of i) {
            if (component_list[j] != undefined) {
                new_content += component_list[j].js; 
            }
        }
    }
    
    fs.writeFileSync(path.resolve(output), new_content);
    console.log("编译完成\n");
}

let iteratorImport = function (level, import_list, component_list, import_layout) {
    for (let i in import_list) {
        if (component_list[i] == undefined) continue;
        let current = component_list[i];
        import_layout.add(level, i);
        iteratorImport(level+1, current.imports, component_list, import_layout);
    }
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