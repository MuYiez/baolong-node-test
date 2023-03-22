// 导入数据库操作模块
const db = require('../db/index')
const moment = require('moment')
var mysql = require('mysql')
const batchUpdate = require('../commom/batchUpdate')
const execTransection = require('../commom/execTransection')

// 参数信息表查询
exports.parameterSearch = (req, res) => {
    const sql = `select * from account_parameter`
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        // if (results.length !== 1) return res.cc('获取参数信息失败！')
        res.send({
            code: 200,
            message: '获取参数信息成功！',
            data: results
        })
    })
}

// 参数信息新增
exports.parameterAdd = (req, res) => {
    const sql = `insert into account_parameter set ?`
    db.query(sql, [req.body], (err, results) => {
        if (err) return res.cc(err)
        res.send({
            code: 200,
            message: '新增参数信息成功！',
            data: {
                id: results.insertId
            }
        })
    })
}

// 参数信息删除
exports.parameterDel = (req, res) => {
    const sql = `delete from account_parameter where id=${req.body.id}`
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        res.send({
            code: 200,
            message: '删除参数信息成功！'
        })
    })
}

// 参数信息修改
exports.parameterEdit = (req, res) => {
    const { id, label, value } = req.body
    const sql = `update account_parameter set label='${label}',value='${value}' where id=${id}`
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        res.send({
            code: 200,
            message: '修改参数信息成功！'
        })
    })
}

// 账单信息查询
exports.accountSearch = (req, res) => {
    const { date, type, paymentMethod, paymentReady } = req.body
    let pageNum = (req.body.pageNum == undefined) ? 1 : Number(req.body.pageNum);
    let pageSize = (req.body.pageSize == undefined) ? 10 : Number(req.body.pageSize);
    let startPage = (pageNum - 1) * pageSize;
    //查询总条数
    let count = 'SELECT count(*) FROM account_info i where 1=1 '
    let sql = `SELECT i.* FROM account_info i where 1=1 `
    if (type) {
        sql = sql + `and i.type='${type}' `
        count = count + `and i.type='${type}' `
    }
    if (paymentMethod) {
        sql = sql + `and i.paymentMethod='${paymentMethod}' `
        count = count + `and i.paymentMethod='${paymentMethod}' `
    }
    if (paymentReady) {
        sql = sql + `and i.paymentReady='${paymentReady}' `
        count = count + `and i.paymentReady='${paymentReady}' `
    }
    if (date.length !== 0) {
        sql = sql + `and str_to_date(i.date,'%Y-%m-%d %H:%i:%s') >= str_to_date('${date[0]}','%Y-%m-%d %H:%i:%s') and str_to_date(i.date,'%Y-%m-%d %H:%i:%s') <= str_to_date('${date[1]}','%Y-%m-%d %H:%i:%s') `
        count = count + `and str_to_date(i.date,'%Y-%m-%d %H:%i:%s') >= str_to_date('${date[0]}','%Y-%m-%d %H:%i:%s') and str_to_date(i.date,'%Y-%m-%d %H:%i:%s') <= str_to_date('${date[1]}','%Y-%m-%d %H:%i:%s') `
    }
    const sortSql = `ORDER BY date DESC,id DESC`
    const calculate_sql = sql + sortSql
    // 根据page参数进行查询
    if (pageNum === 1) {
        sql = sql + sortSql + ` limit ${pageSize}`;
    } else if (pageNum !== 1) {
        sql = sql + sortSql + ` limit ${startPage},${pageSize}`;
    }
    db.query(count, (err, results) => {
        if (err) return res.cc(err)
        let countNum = results[0]['count(*)'];
        const p1 = new Promise((resolve, reject) => {
            db.query(sql, (err, results1) => {
                if (err) return reject(err)
                resolve(results1)
            })
        })
        const p2 = new Promise((resolve, reject) => {
            db.query(calculate_sql, (err, results1) => {
                if (err) return reject(err)
                resolve(results1)
            })
        })

        Promise.all([p1, p2]).then(results => {
            res.send({
                code: 200,
                message: '查询账单信息成功！',
                data: {
                    list: results[0],
                    total: countNum,
                    sum: calculateAccount(results[1]),
                },
            })
        })
    })
}

//账单计算总金额
const calculateAccount = (list) => {
    return {
        income: sum(list, 'income'),
        expand: sum(list, 'expand'),
        total: list.length,
        amount: (Number(sum(list, 'income')) - Number(sum(list, 'expand'))).toFixed(2)
    }
}

//计算数组总额
const sum = (arr, key, type = false) => {
    let num = 0;
    arr.forEach((res) => {
        num = num + Number(res[key] ? res[key] : 0);
    });
    if (type) {
        return num;
    }
    return num.toFixed(2);
};

// 新增账单
exports.accountAdd = (req, res) => {
    const { list } = req.body
    checkAccount(list).then(result => {
        const lastData = result[0]
        const updateDate = result[1]

        //将待插入数据与待更新数据合并，按照时间从小到大排序
        const sortArray = list.concat(updateDate).sort(function (a, b) {
            const lastTime = getHaomiao(a.date)
            const nextTime = getHaomiao(b.date)
            return lastTime - nextTime
        })
        let insertList = []
        let updateList = []
        let begin_price = lastData.end_price
        sortArray.forEach((element, index) => {
            element.begin_price = begin_price
            element.end_price = (Number(begin_price) - Number(element.expand) + Number(element.income)).toFixed(2)
            let item = [
                element.date,
                element.type,
                element.paymentMethod,
                element.paymentReady,
                element.origin,
                element.expand,
                element.income,
                element.begin_price,
                element.end_price
            ]
            //将下一个期初金额设置为当前期末金额
            begin_price = element.end_price
            if (element.id) {
                updateList.push(element)
            } else {
                insertList.push(item)
            }
        });
        //插入
        const sql = `insert into account_info (date,type,paymentMethod,paymentReady,origin,expand,income,begin_price,end_price)values ?`
        //更新
        if (updateList.length === 0) {
            db.query(sql, [insertList], (err, results) => {
                if (err) {
                    console.log(err)
                    return
                }
                res.send({
                    code: 200,
                    message: '新增账单信息成功！'
                })
            })
        } else {
            const sql1 = batchUpdate('account_info', 'id', updateList, ['begin_price', 'end_price'])
            execTransection([{
                sql: sql,
                values: [insertList]
            }, {
                sql: sql1,
                values: []
            }]).then(resp => {
                res.send({
                    code: 200,
                    message: '新增账单信息成功！'
                })
            }).catch(err => {
                console.log(err)
                res.cc('新增账单信息失败！')
            })
        }
    })
}

/**
 * 查询该插入数据时间最前的数据，并获取该时间前一条的数据和该时候后面的所有数据，进行重新计算并返回
 * @param {插入的数据} insertList 
 * @returns 一个对象，包含待插入数组insertArray和待更新数组updateArray
 */
const checkAccount = (insertList) => {
    let earlyDate = insertList[0].date
    insertList.forEach(res => {
        //若当前时间比循环列表时间晚，则重置为循环列表时间
        if (getHaomiao(earlyDate) > getHaomiao(res.date)) {
            earlyDate = res.date
        }
    })
    //查询最早时间上一条数据跟后面所有数据
    const p1 = new Promise((resolve, reject) => {
        const sql = `SELECT i.* FROM account_info i where str_to_date(i.date,'%Y-%m-%d %H:%i:%s') <= str_to_date('${earlyDate}','%Y-%m-%d %H:%i:%s') ORDER BY date DESC,id DESC`
        db.query(sql, (err, results) => {
            if (err) {
                reject(err)
                return
            }
            resolve(results[0])
        })
    })
    const p2 = new Promise((resolve, reject) => {
        const sql = `SELECT i.* FROM account_info i where str_to_date(i.date,'%Y-%m-%d %H:%i:%s') > str_to_date('${earlyDate}','%Y-%m-%d %H:%i:%s') ORDER BY date,id`
        db.query(sql, (err, results) => {
            if (err) {
                reject(err)
                return
            }
            resolve(results)
        })
    })
    return Promise.all([p1, p2])
}

/**
 * 查询该插入数据时间最前的数据，并获取该时间前一条的数据和该时候后面的所有数据，进行重新计算并返回
 * @param {插入的数据} insertList 
 * @returns 一个对象，包含待插入数组insertArray和待更新数组updateArray
 */
const checkEditAccount = (insertList) => {
    let earlyDate = insertList[0].date
    insertList.forEach(res => {
        //若当前时间比循环列表时间晚，则重置为循环列表时间
        if (getHaomiao(earlyDate) > getHaomiao(res.date)) {
            earlyDate = res.date
        }
    })
    //查询最早时间上一条数据跟后面所有数据
    const p1 = new Promise((resolve, reject) => {
        const sql = `SELECT i.* FROM account_info i where str_to_date(i.date,'%Y-%m-%d %H:%i:%s') < str_to_date('${earlyDate}','%Y-%m-%d %H:%i:%s') ORDER BY date DESC,id DESC`
        db.query(sql, (err, results) => {
            if (err) {
                reject(err)
                return
            }
            resolve(results[0])
        })
    })
    const p2 = new Promise((resolve, reject) => {
        const sql = `SELECT i.* FROM account_info i where str_to_date(i.date,'%Y-%m-%d %H:%i:%s') >= str_to_date('${earlyDate}','%Y-%m-%d %H:%i:%s') ORDER BY date,id`
        db.query(sql, (err, results) => {
            if (err) {
                reject(err)
                return
            }
            resolve(results)
        })
    })
    return Promise.all([p1, p2])
}

/**
 * 将时间转换为毫秒数
 * @param {时间} time 
 * @returns 毫秒数
 */
const getHaomiao = (time) => {
    var starttime = time.replace(new RegExp("-", "gm"), "/");
    return (new Date(starttime)).getTime()
}

//修改账单
exports.accountEdit = (req, res) => {
    const { id, date } = req.body
    db.query(`select i.date from account_info i where id = '${id}'`, (err, results) => {
        if (err) {
            return
        }
        let earlyDate = date
        if (getHaomiao(date) > getHaomiao(results[0].date)) {
            earlyDate = results[0].date
        }
        checkEditAccount([{ date: earlyDate }]).then(results => {
            const lastData = results[0]
            let list = results[1]
            const updateIndex = results[1].findIndex(item => item.id === id)
            //若更新的数据日期修改为较前日期
            if (updateIndex !== -1) {
                list[updateIndex] = req.body
            } else {
                list.push(req.body)
            }

            let begin_price = 0
            if (lastData) {
                begin_price = lastData.end_price
            }
            //将待插入数据与待更新数据合并，按照时间从小到大排序
            /**
             * TODO:这里的排序有瑕疵，只按时间进行排序，没有按id大小排序
             */
            const sortArray = list.sort(function (a, b) {
                const lastTime = getHaomiao(a.date)
                const nextTime = getHaomiao(b.date)
                return lastTime - nextTime
            })
            const updateList = []
            sortArray.forEach((element, index) => {
                element.begin_price = begin_price
                element.end_price = (Number(begin_price) - Number(element.expand) + Number(element.income)).toFixed(2)
                //将下一个期初金额设置为当前期末金额
                begin_price = element.end_price
                updateList.push(element)
            });
            const updateArray = []
            for (const key in req.body) {
                if (Object.hasOwnProperty.call(req.body, key) && key !== 'id') {
                    updateArray.push(key)
                }
            }
            //更新
            const sql1 = batchUpdate('account_info', 'id', updateList, updateArray)
            db.query(sql1, (err, results) => {
                if (err) {
                    console.log(err)
                    return
                }
                res.send({
                    code: 200,
                    message: '修改账单信息成功！'
                })
            })
        })
    })
}

//删除账单
exports.accountDelete = (req, res) => {
    const { id } = req.body
    db.query(`select i.date,i.begin_price from account_info i where id = '${id}'`, (err, results) => {
        if (err) {
            return
        }
        checkEditAccount([{ date: results[0].date }]).then(results => {
            const lastData = results[0]
            let list = results[1]
            const updateIndex = results[1].findIndex(item => item.id === id)
            list.splice(updateIndex, 1)
            let begin_price = 0
            if (lastData) {
                begin_price = lastData.end_price
            }
            //将待插入数据与待更新数据合并，按照时间从小到大排序
            const sortArray = list.sort(function (a, b) {
                const lastTime = getHaomiao(a.date)
                const nextTime = getHaomiao(b.date)
                return lastTime - nextTime
            })
            const updateList = []
            sortArray.forEach((element, index) => {
                element.begin_price = begin_price
                element.end_price = (Number(begin_price) - Number(element.expand) + Number(element.income)).toFixed(2)
                //将下一个期初金额设置为当前期末金额
                begin_price = element.end_price
                updateList.push(element)
            });
            //更新
            if (updateList.length === 0) {
                db.query(`delete from account_info where id='${id}'`, (err, results) => {
                    if (err) {
                        console.log(err)
                        return
                    }
                    res.send({
                        code: 200,
                        message: '删除账单信息成功！'
                    })
                })
            } else {
                const sql1 = batchUpdate('account_info', 'id', updateList, ['begin_price', 'end_price'])
                execTransection([{
                    sql: `delete from account_info where id='${id}'`,
                    values: []
                }, {
                    sql: sql1,
                    values: []
                }]).then(resp => {
                    res.send({
                        code: 200,
                        message: '删除账单信息成功！'
                    })
                }).catch(err => {
                    console.log(err)
                    res.cc('删除账单信息失败！')
                })
            }
        })
    })
}

//修改付款情况
exports.changePaymentReady = (req, res) => {
    const { id, paymentReady } = req.body
    const sql = `update account_info set paymentReady='${paymentReady}' where id='${id}'`
    db.query(sql, (err, results) => {
        if (err) {
            console.log(err)
            return
        }
        res.send({
            code: 200,
            message: '修改付款情况成功！'
        })
    })
}