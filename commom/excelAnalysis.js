//引入node-xlsx解析excel模块
var node_xlsx = require('node-xlsx');
var formidable = require('formidable');
var multiparty = require('multiparty');

let form = new multiparty.Form();

function excelAnalysis(req) {
    return new Promise((resolve, reject) => {
        form.parse(req, function (err, fields, file) {
            resolve({
                fields,
                file:node_xlsx.parse(file.file[0].path)
            })
            //解析完数据后需要将form重置，否则会报错
            form = new multiparty.Form()
        });
    })
}

module.exports = excelAnalysis