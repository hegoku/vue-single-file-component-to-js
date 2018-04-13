<template>
    <div>
        <span>{{msg}}</span>
    </div>
</template>

<script>
export default {
    data: function(){
        return {
            msg: ''
        }
    },
    mounted: function() {
        this.msg='11';
    }
}
</script>

<style scoped>
span{font-size:20px; color:yellow;}
</style>