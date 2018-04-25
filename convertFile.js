const compiler = require('@vue/component-compiler-utils');
const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const hash = require('hash-sum');
const { JSDOM } = jsdom;

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

module.exports=convertFile;