// 导入数据库操作模块
const db = require('../db/index')
const moment = require('moment')
var mysql = require('mysql')

const execTransection = require('../commom/execTransection')
const calculateGrossProfit = require('../commom/calculateGrossProfit')
const calculateTotal = require('../commom/calculateTotal')
const calculateAllData = require('../commom/calculateAllData')

// 参数信息表查询
exports.parameterSearch = (req, res) => {
    let date = req.body.date
    if (!date) {
        date = moment(new Date()).format('YYYY-MM-DD')
    }
    const sql = `select i.* from sku_parameter i where date = '${date}'`
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        if (results.length !== 1) return res.cc('获取参数信息失败！')
        res.send({
            code: 200,
            message: '获取参数信息成功！',
            data: {
                ...results[0]
            }
        })
    })
}

// 参数信息表修改
exports.parameterChange = (req, res) => {
    const { exchangeRate, date, estimatedProportion, operatingCost, paypalWithdrawDeposit, D01, D02, D03, D04, D05, D06, D07, D08 } = req.body
    const sql = `update sku_parameter set exchangeRate='${exchangeRate}',estimatedProportion='${estimatedProportion}',operatingCost='${operatingCost}',paypalWithdrawDeposit='${paypalWithdrawDeposit}',D01='${D01}',D02='${D02}',D03='${D03}',D04='${D04}',D05='${D05}',D06='${D06}',D07='${D07}',D08='${D08}' where date = '${date}'`
    // 更新参数表
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        res.send({
            code: 200,
            message: '修改参数信息成功！',
            data: {
                ...results[0]
            }
        })
    })
}


//sku商品查询
exports.skuGoodsAutosearch = (req, res) => {
    let sql = ''
    if (req.body.sku_goods_id) {
        sql = `SELECT i.sku_goods_id, g.name_cn, g.purchase_ref_price, g.length, g.wide, g.height, g.weight,g.img_id,j.dangerous_goods FROM sku_warehouse_info i JOIN sku_goods_info g ON i.sku_goods_id = g.sku_goods_id join sku_customs_info j on i.sku_goods_id = j.sku_goods_id WHERE i.sku_goods_id="${req.body.sku_goods_id}"`
    } else if (req.body.name_cn) {
        sql = `SELECT i.sku_goods_id, g.name_cn, g.purchase_ref_price, g.length, g.wide, g.height, g.weight,g.img_id,j.dangerous_goods FROM sku_goods_info g JOIN sku_warehouse_info i ON g.sku_goods_id = i.sku_goods_id join sku_customs_info j on i.sku_goods_id = j.sku_goods_id where g.name_cn like "%${req.body.name_cn}%"`
    } else {
        res.send({
            code: 200,
            message: '获取sku商品信息成功！',
            data: []
        })
        return
    }
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        const img_array = []
        results = results.map(item => {
            item.img_id = item.img_id ? item.img_id.split(',')[0] : ''
            if (item.img_id) {
                img_array.push(item.img_id)
            }
            return item
        })
        const sql = `select url,id from pictrue_info where id in ('${img_array.join("','")}')`
        db.query(sql, (err, list) => {
            if (err) return res.cc(err)
            res.send({
                code: 200,
                message: '获取sku商品信息成功！',
                data: results.map(item => {
                    return {
                        ...item,
                        ...list.find(data => data.id == item.img_id)
                    }
                })
            })
        })
    })
}

//每日毛利表保存
exports.addDailyTable = (req, res) => {
    const { user_id, calculate_date, total, list } = req.body
    const daily_gross_margin = {
        user_id, calculate_date, total
    }

    let sqls = ''
    list.forEach(element => {
        const { sku_goods_id, name_cn, purchase_ref_price, weight, length, wide, height, salesVolume, orderQuantity, businessVolume, adRate, gramPrice } = element
        let model_sql = `insert into gross_margin_table(sku_goods_id,name_cn,calculate_date,purchase_ref_price,weight,length,wide,height,salesVolume,orderQuantity,businessVolume,adRate,gramPrice,user_id)values("${sku_goods_id}","${name_cn}","${calculate_date}","${purchase_ref_price}","${weight}","${length}","${wide}","${height}","${salesVolume}","${orderQuantity}","${businessVolume}",${adRate},${gramPrice},"${user_id}")`;
        sqls += mysql.format(model_sql, element) + ';'
    });
    execTransection([{
        sql: `insert into daily_gross_margin set ?`,
        values: daily_gross_margin
    }, {
        sql: sqls,
        values: []
    }]).then(resp => {
        res.send({
            code: 200,
            message: '新增毛利信息成功！',
            data: {}
        })
    }).catch(err => {
        console.log(err)
        if (err.sqlState === '23000') {
            res.cc('该日期已有毛利信息')
        } else {
            res.cc('新增毛利信息失败！')
        }
    })
}

//查询每日毛利
exports.searchDailyTable = (req, res) => {
    const { calculate_date, user_id } = req.body
    let pageNum = (req.body.pageNum == undefined) ? 1 : Number(req.body.pageNum);
    let pageSize = (req.body.pageSize == undefined) ? 10 : Number(req.body.pageSize);
    let startPage = (pageNum - 1) * pageSize;

    let conditionSql = ' where 1=1'
    //判断是否有条件查询
    if (calculate_date.length !== 0) {
        conditionSql = conditionSql + ` and str_to_date(i.calculate_date,'%Y-%m-%d') >= str_to_date('${calculate_date[0]}','%Y-%m-%d') and str_to_date(i.calculate_date,'%Y-%m-%d') <= str_to_date('${calculate_date[1]}','%Y-%m-%d')`
    }
    if (user_id) {
        conditionSql = conditionSql + ` and i.user_id='${user_id}'`
    }
    const sortSql = ` order by i.calculate_date desc`
    let sql = ''
    //查询总条数
    let count = 'select count(*) as count from daily_gross_margin i' + conditionSql
    //查询没有加条数限制的数据
    let sqlTotal = `select i.*,j.nickname,g.* from daily_gross_margin i join users j on i.user_id=j.id join sku_parameter g on i.calculate_date=g.date` + conditionSql + sortSql;

    // 根据page参数进行查询
    if (pageNum === 1) {
        sql = `select i.*,j.nickname,g.* from daily_gross_margin i join users j on i.user_id=j.id join sku_parameter g on i.calculate_date=g.date` + conditionSql + sortSql + ` limit ${pageSize}`;
    } else if (pageNum !== 1) {
        sql = `select i.*,j.nickname,g.* from daily_gross_margin i join users j on i.user_id=j.id join sku_parameter g on i.calculate_date=g.date` + conditionSql + sortSql + ` limit ${startPage},${pageSize}`;
    }
    db.query(count, (err, results) => {
        if (err) return res.cc(err)
        let countNum = results[0].count;
        db.query(sql, (err, results) => {
            if (err) return res.cc(err)
            db.query(sqlTotal, (err, resultsTotal) => {
                if (err) return res.cc(err)
                //查询所有符合要求的毛利数据进行计算总额
                calculateList(results).then(({ sortList }) => {
                    calculateAllList(resultsTotal).then((totalData) => {
                        res.send({
                            code: 200,
                            message: '查询每日毛利信息成功！',
                            data: {
                                list: results.map(list => {
                                    return {
                                        ...list,
                                        ...calculateTotal(sortList[list.calculate_date] ? sortList[list.calculate_date][list.user_id] : [])
                                    }
                                }),
                                totalData,
                                total: countNum,
                            }
                        })
                    })
                })
            })
        })
    })
}

//统计所有数据总和
function calculateAllList(list) {
    const calculate_date_array = []
    const user_id_array = []
    list.forEach(res => {
        calculate_date_array.push(res.calculate_date)
        user_id_array.push(res.user_id)
    })
    const calculate_date_string = calculate_date_array.join("','")
    const user_id_string = user_id_array.join("','")
    const sql = `select i.*,j.*,g.purchase_ref_price,g.weight,g.weight,g.wide,g.height from gross_margin_table i join sku_parameter j on i.calculate_date=j.date join sku_goods_info g on i.sku_goods_id=g.sku_goods_id where calculate_date in ('${calculate_date_string}') and user_id in ('${user_id_string}')`
    return new Promise((resolve, reject) => {
        db.query(sql, (err, results) => {
            if (err) return reject(err)
            //查询所有符合要求的毛利数据进行计算总额
            const totalList = []
            results.forEach(data => {
                const index = list.findIndex(element => element.calculate_date === data.calculate_date)
                totalList.push(calculateGrossProfit(list[index], data))
            })

            // 计算所有的列表加起来的总额
            resolve({
                ...calculateAllData(totalList)
            })
        })
    })
}

//根据当前毛利列表查询详情，并计算出总额
function calculateList(list) {
    const calculate_date_array = []
    const user_id_array = []
    list.forEach(res => {
        calculate_date_array.push(res.calculate_date)
        user_id_array.push(res.user_id)
    })
    const calculate_date_string = calculate_date_array.join("','")
    const user_id_string = user_id_array.join("','")
    const sql = `select * from gross_margin_table where calculate_date in ('${calculate_date_string}') and user_id in ('${user_id_string}')`
    return new Promise((resolve, reject) => {
        db.query(sql, (err, results) => {
            if (err) return res.cc(err)
            //查询所有符合要求的毛利数据进行计算总额
            const totalList = []
            const p = []
            results.forEach(data => {
                //根据sku查找出对应的商品属性
                const sku_array = []
                data.sku_goods_id.split('+').forEach(sku => {
                    sku_array.push(sku.split('*')[0])
                })
                const goodsSql = `select i.sku_goods_id,i.purchase_ref_price,i.weight,i.length,i.wide,i.height from sku_goods_info i where sku_goods_id in ('${sku_array.join("','")}')`
                p.push(new Promise((resolve, reject) => {
                    db.query(goodsSql, (err, results) => {
                        if (err) return reject(err)
                        //计算sku的合计商品信息
                        let purchase_ref_price = 0, weight = 0, length = 0, wide = 0, height = 0
                        data.sku_goods_id.split('+').forEach(sku => {
                            const goodsItem = results.find(item => item.sku_goods_id === sku.split('*')[0]) ? results.find(item => item.sku_goods_id === sku.split('*')[0]) : {}
                            const sku_num = Number(sku.split('*')[1] ? sku.split('*')[1] : 1)
                            purchase_ref_price += Number(goodsItem.purchase_ref_price) * sku_num
                            weight += Number(goodsItem.weight) * sku_num
                            //长宽高现在暂无法计算，所以按照最后一个sku回填
                            length = goodsItem.length
                            wide = goodsItem.wide
                            height = goodsItem.height
                        })
                        const index = list.findIndex(element => element.calculate_date === data.calculate_date)
                        totalList.push(calculateGrossProfit(list[index], {
                            ...data,
                            purchase_ref_price, weight: weight.toFixed(2), length, wide, height
                        }))
                        resolve()
                    })
                }))
            })
            Promise.all(p).then(results => {
                //将数据根据日期和人员归类
                let sameType = classify(totalList, "calculate_date");
                let sortList = {}
                for (const key in sameType) {
                    if (Object.hasOwnProperty.call(sameType, key)) {
                        const element = sameType[key];
                        sortList[key] = classify(element, "user_id")
                    }
                }
                // TODO:计算所有的列表加起来的总额
                resolve({
                    sortList
                })
            })
        })
    })
}

//数据归类方法
function classify(arr, key) {
    let kind = []; //存放属性标识
    let newArr = {}; //返回的数据
    arr.forEach((item) => {
        // 判断key是否存在，不存在则添加
        if (!kind.includes(item[key])) {
            kind.push(item[key]); //kind添加新标识
            newArr[item[key]] = []
        }
        let index = kind.indexOf(item[key]); //返回带有标识在kind内的下标，判断加入哪个数组
        newArr[item[key]].push(item); //将对象存入数组
    });
    return newArr;
}

//查询毛利表详情
exports.getTableDetail = (req, res) => {
    const { calculate_date, user_id } = req.body
    //查询毛利表内sku商品总数
    let count = `select count(*) as count from gross_margin_table where calculate_date='${calculate_date}'`
    //查询毛利表内汇率跟日期信息
    let sql1 = `select i.user_id,j.nickname from daily_gross_margin i join users j on i.user_id=j.id where i.calculate_date='${calculate_date}'`
    //查询毛利表内毛利详情
    let sql2 = `select i.* from gross_margin_table i where i.calculate_date='${calculate_date}'`
    //查询参数信息表
    const sql3 = `select i.* from sku_parameter i where date = '${calculate_date}'`
    //判断是否查询所有人的信息
    if (user_id) {
        count = count + ` and user_id='${user_id}'`
        sql1 = sql1 + ` and i.user_id='${user_id}'`
        sql2 = sql2 + ` and i.user_id='${user_id}'`
    }

    db.query(sql1, (err, results) => {
        if (err) return res.cc(err)
        const obj = results[0]
        db.query(count, (err, results) => {
            if (err) return res.cc(err)
            const count = results[0].count
            db.query(sql2, (err, results1) => {
                if (err) return res.cc(err)
                //查询sku对应商品信息
                const p = []
                const list = []
                results1.forEach(data => {
                    //根据sku查找出对应的商品属性
                    const sku_array = []
                    data.sku_goods_id.split('+').forEach(sku => {
                        sku_array.push(sku.split('*')[0])
                    })
                    const goodsSql = `select i.sku_goods_id,i.purchase_ref_price,i.weight,i.length,i.wide,i.height from sku_goods_info i where sku_goods_id in ('${sku_array.join("','")}')`
                    p.push(new Promise((resolve, reject) => {
                        db.query(goodsSql, (err, results) => {
                            if (err) return reject(err)
                            //计算sku的合计商品信息
                            let purchase_ref_price = 0, weight = 0, length = 0, wide = 0, height = 0
                            data.sku_goods_id.split('+').forEach(sku => {
                                const goodsItem = results.find(item => item.sku_goods_id === sku.split('*')[0]) ? results.find(item => item.sku_goods_id === sku.split('*')[0]) : {}
                                const sku_num = Number(sku.split('*')[1] ? sku.split('*')[1] : 1)
                                purchase_ref_price += Number(goodsItem.purchase_ref_price) * sku_num
                                weight += Number(goodsItem.weight) * sku_num
                                //长宽高现在暂无法计算，所以按照最后一个sku回填
                                length = goodsItem.length
                                wide = goodsItem.wide
                                height = goodsItem.height
                            })
                            list.push({ ...data, purchase_ref_price, weight: weight.toFixed(2), length, wide, height })
                            resolve()
                        })
                    }))
                })
                Promise.all(p).then(() => {
                    db.query(sql3, (err, results2) => {
                        if (err) return res.cc(err)
                        if (results2.length !== 1) return res.cc('获取参数信息失败！')
                        res.send({
                            code: 200,
                            message: '获取sku商品信息成功！',
                            data: {
                                ...obj,
                                ...results2[0],
                                list: list.sort((a, b) => { return Number(a.id) - Number(b.id) }),
                                total: count
                            }
                        })
                    })
                })
            })
        })
    })
}

//修改毛利
exports.editDailyTable = (req, res) => {
    const { user_id, calculate_date, operatingCost, gramPrice, gram, unitPrice, exchangeRate, total, salesVolumeTotal, orderQuantityTotal, businessVolumeTotal, adRateTotal, freightTotal, procurementCostTotal, serviceChargeTotal, estimatedProfitTotal, list, paypalCostTotal, paypalWithdrawDeposit } = req.body
    const daily_gross_margin = {
        total
    }

    //更新daily_gross_margin表内的数据
    let sql1 = `update daily_gross_margin set `
    for (const key in daily_gross_margin) {
        if (Object.hasOwnProperty.call(daily_gross_margin, key)) {
            const element = daily_gross_margin[key];
            sql1 = sql1 + key + "='" + element + "',"
        }
    }
    sql1 = sql1.slice(0, sql1.length - 1)
    sql1 = sql1 + ` where calculate_date='${calculate_date}' and user_id='${user_id}'`
    //删除gross_margin_table表内的所有该日期的数据
    let sql2 = `delete from gross_margin_table where calculate_date='${calculate_date}' and user_id='${user_id}'`
    //插入gross_margin_table表内的新日期数据
    let sql3 = ''
    list.forEach(element => {
        const { sku_goods_id, name_cn, purchase_ref_price, weight, length, wide, height, salesVolume, orderQuantity, businessVolume, adRate, gramPrice, freight, procurementCost, serviceCharge, perCustomerTransaction, grossProfitRatio, roi, estimatedProfit, paypalCost } = element
        let model_sql = `insert into gross_margin_table(sku_goods_id,name_cn,calculate_date,purchase_ref_price,weight,length,wide,height,salesVolume,orderQuantity,businessVolume,adRate,gramPrice,freight,procurementCost,serviceCharge,perCustomerTransaction,grossProfitRatio,roi,estimatedProfit,paypalCost,user_id)values("${sku_goods_id}","${name_cn}","${calculate_date}","${purchase_ref_price}","${weight}","${length}","${wide}","${height}","${salesVolume}","${orderQuantity}","${businessVolume}",${adRate},${gramPrice},"${freight}","${procurementCost}","${serviceCharge}","${perCustomerTransaction}","${grossProfitRatio}","${roi}","${estimatedProfit}","${paypalCost}","${user_id}")`;
        sql3 += mysql.format(model_sql, element) + ';'
    });
    execTransection([{
        sql: sql2,
        values: []
    }, {
        sql: sql1,
        values: []
    }, {
        sql: sql3,
        values: []
    }]).then(resp => {
        res.send({
            code: 200,
            message: '修改毛利信息成功！',
            data: {}
        })
    }).catch(err => {
        console.log(err)
        res.cc('修改毛利信息失败！')
    })
}

//查询商品危险品属性
exports.searchDangerousGoods = (req, res) => {
    const sql = `select i.dangerous_goods from sku_customs_info i where sku_goods_id='${req.body.sku_goods_id}'`
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        if (results.length !== 1) return res.cc('查询商品危险品属性失败！')
        res.send({
            code: 200,
            message: '查询商品危险品属性成功！',
            data: results[0]
        })
    })
}

//修改毛利表栏位排序
exports.editGrossColumns = (req, res) => {
    const user_id = req.user.id
    const ins_sql = `insert into user_gross_sort (column_key,title,user_id,req,is_show)values ? on duplicate key update req=VALUES(req),is_show=VALUES(is_show)`
    const ins_data = []
    req.body.list.forEach(item => {
        const { column_key, title, req, is_show } = item
        ins_data.push([column_key, title, user_id, req, is_show])
    })
    db.query(ins_sql, [ins_data], (err, results) => {
        if (err) return res.cc(err)
        res.send({
            code: 200,
            message: '修改毛利表栏位排序成功！'
        })
    })
}

//获取毛利表栏位排序
exports.getGrossColumns = (req, res) => {
    const user_id = req.user.id
    const sql = `select * from user_gross_sort where user_id=${user_id}`
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        res.send({
            code: 200,
            message: '获取毛利表栏位排序成功！',
            data: results
        })
    })
}