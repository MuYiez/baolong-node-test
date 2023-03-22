let findStrSubtringToStart = (str, cha, num) => {
    var x = str.indexOf(cha)
    for (var i = 0; i < num; i++) {
        x = str.indexOf(cha, x + 1)
    }
    return str.substring(0, x)
}

// 5. 导出配置好的multerConfig
module.exports = findStrSubtringToStart;