## Installation

```sh
$ npm i vue-single-file-component-to-js
```

## How to use

```sh
$ node index.js /path/to/vue/file.vue /path/to/js/file.js
$ node index.js /path/to/vue/folder /path/to/js/file.js
```

If you want to convert file when file changed, you can add `--watch` as the 3rd argument:

```sh
$ node index.js /path/to/vue/folder /path/to/js/file.js --watch
```

Supposing that .vue file is like:

```vue
<template>
    <div>
        <button class="btn" @click="save">Save</button>
    </div>
</template>

<script>
export default {
    name: 'MyComponent',
    data: function(){
        return {}
    },
    methods: {
        save: function(){
            alert('save');
        }
    }
}
</script>

<style scoped>
.btn {font-size:20px;}
</style>
```

And js file will be:

```js
// ...defination of function docReady
var MyComponent={
    template: `<div data-v-32jh24>
        <button data-v-32jh24 class="btn" @click="save">Save</button>
    </div>`,
    name: 'MyComponent',
    data: function(){
        return {}
    },
    methods: {
        save: function(){
            alert('save');
        }
    }
};
docReady(function(){
    var css = `.btn[data-v-32jh24] {font-size:20px;}`;
    var head = document.getElementsByTagName('head')[0];
    var style = document.createElement('style');
    style.type = 'text/css';
    if(style.styleSheet){
        style.styleSheet.cssText = css;
    }else{
        style.appendChild(document.createTextNode(css));
    }
    head.appendChild(style);
});
```

After convert to js file, you can use it in javascript:

```html
<html>
<head>
    <script src="vue.js"></script>
    <script src="/path/to/js/file.js"></script>
</head>
<body>
    <div id="app">
        <my-component></my-component>
    </div>
    <script>
    Vue.use('my-component', MyComponent);
    var app=new Vue({
        el: '#app'
    });
    </script>
</body>
</html>
``` 