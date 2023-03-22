
var schedule = require('node-schedule');
const moment = require('moment')
// 导入数据库操作模块
const db = require('../db/index')
var request = require('request');

//每天6点获取最新汇率，并填进数据库中
function getExchangeRate() {
    schedule.scheduleJob('0 0 10 * * *', function () {
        request('https://www.chinamoney.com.cn/ags/ms/cm-u-bk-ccpr/CcprHisNew?currency=USD/CNY&startDate=' + moment(new Date()).format('YYYY-MM-DD'), function (err, response, body) {
            //err 当前接口请求错误信息
            //response 一般使用statusCode来获取接口的http的执行状态
            //body 当前接口response返回的具体数据 返回的是一个jsonString类型的数据 
            //需要通过JSON.parse(body)来转换
            if (!err && response.statusCode == 200) {
                var res = JSON.parse(body);
                if (res.records[0]) {
                    const exchangeRate = res.records[0].values[0]
                    const sql = `update sku_parameter set exchangeRate='${exchangeRate}' where date = '${moment(new Date()).format('YYYY-MM-DD')}'`
                    // 更新参数表
                    db.query(sql, (err, results) => {
                        if (err) {
                            console.log(err)
                            return
                        }
                        console.log('成功更新汇率，最新汇率为' + exchangeRate)
                    })
                }
            }
        })
    });
}
module.exports = getExchangeRate;