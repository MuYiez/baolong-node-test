const moment = require('moment')
// 导入数据库操作模块
const db = require('../db/index')

//获取daily_id_list未被占用的id，并生成spu返回
function getExchangeRate(classifyType, department) {
    const sql = 'select * from daily_id_list where is_occupy=0'
    return new Promise((resolve, reject) => {
        db.query(sql, (err, results) => {
            if (err) return reject(err)
            //生成规则（商品类别（QW）+当前日期（20230104）+部门代号（A）+当天序号（01））
            const id = classifyType + moment(new Date()).format('YYYYMMDD') + department + results[0].index_spu_id
            resolve(id)
        })
    })
}
module.exports = getExchangeRate;