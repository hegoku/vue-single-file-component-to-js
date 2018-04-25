let layout = function () {
    this.data = [];
};

layout.prototype.search = function (value) {
    let j = -1;
    let level = 0;
    for (let i in this.data) {
        j = this.data[i].indexOf(value);
        if (j != -1) {
            level = i;
        }
    }
    if (j == -1) {
        return null;
    } else {
        return [level, j];
    }
}

layout.prototype.add = function (layout_level, value) {
    let is_exist = this.search(value);
    if (is_exist != null) {
        this.data[is_exist[0]].splice(is_exist[1], 1);
    }
    if (this.data[layout_level] == undefined) {
        this.data[layout_level] = [];
    }
    this.data[layout_level].push(value);
}

module.exports = layout;