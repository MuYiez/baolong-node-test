// 导入数据库操作模块
const db = require('../db/index')
const getOrder = require('../shopline/getOrder')
const execTransection = require('../commom/execTransection')
const async = require('async');
const moment = require('moment')

exports.getShoplineOrder = (req, res) => {
    const { user } = req.body
    let sql = `select i.* from shopline_info i where 1=1`
    if (user) {
        sql = sql + ` and i.user=${user}`
    }

    const task = []
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        const shop_info = results
        shop_info.forEach(element => {
            task.push((cb) => {
                getOrder(element, cb)
            })
        });
        async.waterfall(task, function (err, result) {
            if (err) {
                console.log(err);
            }
            console.log("订单同步完成！")
        })

        res.send({
            code: 200,
            message: '同步订单中，请稍候~'
        })
    })
}

//获取订单
exports.getOrder = (req, res) => {
    const { id, shopline_name, user, createDate, sku } = req.body
    let pageNum = (req.body.pageNum == undefined) ? 1 : Number(req.body.pageNum);
    let pageSize = (req.body.pageSize == undefined) ? 10 : Number(req.body.pageSize);
    let startPage = (pageNum - 1) * pageSize;
    //查询订单数据库
    let sql = `select distinct i.*,j.user from order_info i join shopline_info j on i.shop_name=j.shopline_name join line_items g on i.id=g.order_id where 1=1`
    if (id) {
        sql = sql + ` and i.id=${id}`
    }
    if (shopline_name) {
        sql = sql + ` and i.shop_name='${shopline_name}'`
    }
    if (user) {
        sql = sql + ` and j.user='${user}'`
    }
    if (sku) {
        sql = sql + ` and g.sku like "%${sku}%"`
    }
    if (createDate.length) {
        sql = sql + ` and str_to_date(i.created_at,'%Y-%m-%d') >= str_to_date('${createDate[0]}','%Y-%m-%d') and str_to_date(i.created_at,'%Y-%m-%d') <= str_to_date('${createDate[1]}','%Y-%m-%d')`
    }
    const count = `select count(*) from (${sql})a`
    // 根据page参数进行查询
    if (pageNum === 1) {
        sql = sql + ` ORDER BY order_at DESC limit ${pageSize}`;
    } else if (pageNum !== 1) {
        sql = sql + ` ORDER BY order_at DESC limit ${startPage},${pageSize}`;
    }
    db.query(count, (err, results) => {
        if (err) return res.cc(err)
        let countNum = results[0]['count(*)'];
        db.query(sql, (err, results1) => {
            if (err) return res.cc(err)
            const p_all = []
            results1.forEach(item => {
                const order_id = item.id
                const user_id = item.user_id
                const fulfillments_info_sql = `select * from fulfillments_info where order_id = '${order_id}'`
                const line_items_sql = `select * from line_items where order_id = '${order_id}'`
                const payment_details_sql = `select * from payment_details where order_id = '${order_id}'`
                const shipping_address_sql = `select * from shipping_address where order_id = '${order_id}'`
                const shipping_lines_sql = `select * from shipping_lines where order_id = '${order_id}'`
                const shopline_customer_info_sql = `select * from shopline_customer_info where id = '${user_id}'`
                const sql_array = [
                    {
                        key: 'fulfillments_info',
                        sql: fulfillments_info_sql
                    },
                    {
                        key: 'line_items',
                        sql: line_items_sql
                    },
                    {
                        key: 'payment_details',
                        sql: payment_details_sql
                    },
                    {
                        key: 'shipping_address',
                        sql: shipping_address_sql
                    },
                    {
                        key: 'shipping_lines',
                        sql: shipping_lines_sql
                    },
                    {
                        key: 'shopline_customer_info',
                        sql: shopline_customer_info_sql
                    },
                ]
                const p_arr = []
                sql_array.forEach(list => {
                    const p = new Promise((resolve, reject) => {
                        db.query(list.sql, (err, results) => {
                            if (err) return reject(err)
                            const obj = {}
                            obj[list.key] = results
                            resolve(obj)
                        })
                    })
                    p_arr.push(p)
                })
                p_all.push(Promise.all(p_arr))
            })

            Promise.all(p_all).then(all_results => {
                const list = all_results.map((item, index) => {
                    return {
                        ...results1[index],
                        fulfillments_info: item[0].fulfillments_info,
                        line_items: item[1].line_items,
                        payment_details: item[2].payment_details,
                        shipping_address: item[3].shipping_address[0],
                        shipping_lines: item[4].shipping_lines,
                        shopline_customer_info: item[5].shopline_customer_info[0],
                    }
                })
                res.send({
                    code: 200,
                    message: '查询订单信息成功！',
                    data: {
                        list,
                        total: countNum
                    },
                })
            })
        })
    })
}

//匹配sku
exports.matchSku = (req, res) => {
    const { old_sku, date, user, list } = req.body
    //先查询原本的sku，通过match_sku去查询
    const search_match_sku_sql = `select * from match_sku where date='${date}' and order_sku='${old_sku}' and user='${user}'`
    //查询所有line_items中信息
    const line_items_sql = `select * from line_items where date='${date}' and old_sku='${old_sku}' and user='${user}'`
    //查询当日参数
    const sku_parameter_sql = `select * from sku_parameter where date='${date}'`
    const p1 = new Promise((resolve, reject) => {
        db.query(search_match_sku_sql, (err, results) => {
            if (err) return reject(err)
            resolve(results)
        })
    })
    const p2 = new Promise((resolve, reject) => {
        db.query(line_items_sql, (err, results) => {
            if (err) return reject(err)
            resolve(results)
        })
    })
    const p4 = new Promise((resolve, reject) => {
        db.query(sku_parameter_sql, (err, results) => {
            if (err) return reject(err)
            resolve(results)
        })
    })
    Promise.all([p1, p2, p4]).then(results => {
        //旧的sku组成
        const old_sku_list = results[0]
        //订单商品信息
        const line_items_list = results[1]
        // 参数信息
        const sku_parameter = results[2][0]
        //商品销量
        let line_number = 0
        line_items_list.forEach(item => {
            line_number += Number(item.quantity)
        })
        //删除match_sku内原本信息,重新插入
        const del_match_sku_sql = `delete from match_sku where order_sku = '${old_sku}' and date='${date}' and user='${user}'`
        //插入match_sku
        const ins_match_sku_sql = `insert into match_sku (order_sku,sku,date,quantity,user,seq)values ?`
        const match_sku = []
        //更新line_items
        const line_items_id_array = []
        line_items_list.forEach(item => {
            line_items_id_array.push(item.id)
        })
        let sku_goods_id = ''
        list.forEach((item, index) => {
            sku_goods_id = sku_goods_id + (index ? '+' : '') + item.sku + (item.quantity != 1 ? '*' + item.quantity : '')
            match_sku.push([
                old_sku, item.sku, date, item.quantity, user, index
            ])
        })
        const update_line_items = `update line_items set sku = '${sku_goods_id}',sku_status='1' where id in ('${line_items_id_array.join("','")}')`
        //更新毛利信息sql
        const update_gross_margin_table = `insert into gross_margin_table (id,calculate_date,user_id,sku_goods_id,name_cn,gramPrice,salesVolume,orderQuantity,businessVolume)values ? on duplicate key update salesVolume=VALUES(salesVolume),orderQuantity=VALUES(orderQuantity),businessVolume=VALUES(businessVolume)`
        const gross_margin_table = []
        //待删除的毛利信息表id
        const gross_id_list = []
        //若原本存在sku
        if (old_sku_list.length) {
            //查询毛利表原本信息
            const sku_list = old_sku_list.map(i => {
                return i.sku
            })
            list.forEach(i => {
                sku_list.push(i.sku)
            })
            const gross_margin_table_sql = `select * from gross_margin_table where calculate_date='${date}' and sku_goods_id in ('${sku_list.join("','")}') and user_id='${user}'`
            db.query(gross_margin_table_sql, (err, results) => {
                if (err) return res.cc(err)
                let old_sku_gross_list = results
                //将原本sku信息跟毛利信息进行比对，若销量被减至0则将该sku的毛利信息删除，否则则进行更新
                const current_gross_list = []
                old_sku_gross_list.forEach(item => {
                    const gross_item = old_sku_list.find(i => i.sku === item.sku_goods_id)
                    if (gross_item) {
                        item.salesVolume = Number(item.salesVolume) - line_number * Number(gross_item.quantity)
                        item.orderQuantity = (item.orderQuantity == 0 ? 0 : Number(item.orderQuantity) - line_items_list.filter((a) => { return a.major === 1 }).length)
                        item.businessVolume = (item.businessVolume == 0 ? 0 : (Number(item.businessVolume) - line_items_list.map(g => g.businessVolume).reduce((prev, curr) => Number(prev) + Number(curr), 0)).toFixed(2))
                    }
                    //判断销量是否为0，0则进行删除
                    if (item.salesVolume == 0) {
                        gross_id_list.push(item.id)
                    } else {
                        //判断毛利信息中是否包含新sku，若不包含则进行更新
                        if (list.findIndex(i => i.sku === item.sku_goods_id) === -1) {
                            //获取毛利信息
                            gross_margin_table.push([
                                item.id,
                                date,
                                user,
                                item.sku_goods_id,
                                item.name_cn,
                                item.gramPrice,
                                item.salesVolume,
                                item.orderQuantity,
                                item.businessVolume,
                            ])
                        }
                        current_gross_list.push(item)
                    }
                })
                //计算新sku信息
                list.forEach((m, index) => {
                    const gross_item = current_gross_list.find(i => i.sku_goods_id === m.sku)
                    let salesVolume = 0
                    let orderQuantity = gross_item ? Number(gross_item.orderQuantity) : 0
                    let businessVolume = gross_item ? Number(gross_item.businessVolume) : 0
                    line_items_list.forEach(item => {
                        businessVolume += Number(item.businessVolume)
                        salesVolume += Number(item.quantity)
                        orderQuantity += item.major
                    })
                    //获取毛利信息
                    gross_margin_table.push([
                        gross_item ? gross_item.id : null,
                        date,
                        user,
                        m.sku,
                        m.name_cn,
                        gross_item ? gross_item.gramPrice : sku_parameter[m.dangerous_goods],
                        gross_item ? Number(m.quantity) * salesVolume + Number(gross_item.salesVolume) : Number(m.quantity) * salesVolume,
                        orderQuantity,
                        businessVolume,
                    ])
                })
                //待删除毛利sql
                let gross_del_sql = 'select 1 from dual'
                if (gross_id_list.length) {
                    gross_del_sql = `delete from gross_margin_table where id in ('${gross_id_list.join("','")}')`
                }
                execTransection([
                    {
                        sql: del_match_sku_sql,
                        values: []
                    },
                    {
                        sql: ins_match_sku_sql,
                        values: [match_sku]
                    },
                    {
                        sql: update_line_items,
                        values: []
                    },
                    {
                        sql: gross_del_sql,
                        values: []
                    },
                    {
                        sql: update_gross_margin_table,
                        values: [gross_margin_table]
                    }
                ]).then(resp => {
                    res.send({
                        code: 200,
                        message: '重新匹配sku成功，毛利表已更新'
                    })
                }).catch(err => {
                    console.log(err)
                })
            })
        } else {
            /**
             * 还需判断新的sku组成是否已存在毛利表中
             */
            const sku_list = list.map(i => {
                return i.sku
            })
            const sql = `select * from gross_margin_table where calculate_date='${date}' and sku_goods_id in ('${sku_list.join("','")}') and user_id='${user}'`
            db.query(sql, (err, results) => {
                if (err) return res.cc(err)

                //更新毛利信息sql
                const update_gross_margin_table = `insert into gross_margin_table (id,calculate_date,user_id,sku_goods_id,name_cn,gramPrice,salesVolume,orderQuantity,businessVolume)values ? on duplicate key update salesVolume=VALUES(salesVolume),orderQuantity=VALUES(orderQuantity),businessVolume=VALUES(businessVolume)`
                const gross_margin_table = []
                //计算新sku信息
                list.forEach((m, index) => {
                    const sku_gross = results.find(i => i.sku_goods_id === m.sku)
                    let salesVolume = 0
                    let orderQuantity = sku_gross ? Number(sku_gross.orderQuantity) : 0
                    let businessVolume = sku_gross ? Number(sku_gross.businessVolume) : 0
                    line_items_list.forEach(item => {
                        businessVolume += Number(item.businessVolume)
                        salesVolume += Number(item.quantity)
                        orderQuantity += item.major
                    })
                    //获取毛利信息
                    gross_margin_table.push([
                        sku_gross ? sku_gross.id : null,
                        date,
                        user,
                        m.sku,
                        m.name_cn,
                        sku_parameter[m.dangerous_goods],
                        sku_gross ? (Number(sku_gross.salesVolume) + Number(m.quantity) * salesVolume).toFixed(2) : Number(Number(m.quantity) * salesVolume).toFixed(2),
                        orderQuantity,
                        businessVolume,
                    ])
                })
                execTransection([
                    {
                        sql: del_match_sku_sql,
                        values: []
                    },
                    {
                        sql: ins_match_sku_sql,
                        values: [match_sku]
                    },
                    {
                        sql: update_line_items,
                        values: []
                    },
                    {
                        sql: update_gross_margin_table,
                        values: [gross_margin_table]
                    }
                ]).then(resp => {
                    res.send({
                        code: 200,
                        message: '重新匹配sku成功，毛利表已更新'
                    })
                }).catch(err => {
                    console.log(err)
                })
            })

        }
    })
}

//查询店铺
exports.searchShop = (req, res) => {
    const sql = `select i.shopline_name from shopline_info i`
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        res.send({
            code: 200,
            message: '获取店铺信息成功',
            data: results
        })
    })
}

//查询sku
exports.searchOrderSku = (req, res) => {
    const { order_id, user } = req.body
    const sql = `select i.created_at,j.old_sku,j.sku,j.image_url from order_info i join line_items j on i.id = j.order_id where i.id = '${order_id}'`
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        if (!results.length) return res.cc('查询失败')
        const created_at = moment(results[0].created_at).format('YYYY-MM-DD')
        const old_sku_string = results.map(item => {
            return item.old_sku
        }).join("','")
        const sql = `select i.*,j.name_cn,j.img_id,g.dangerous_goods,j.purchase_ref_price from match_sku i join sku_goods_info j on i.sku=j.sku_goods_id join sku_customs_info g on i.sku=g.sku_goods_id where i.order_sku in ('${old_sku_string}') and i.date='${created_at}' and i.user='${user}' order by seq`
        db.query(sql, (err, data) => {
            if (err) return res.cc(err)
            const img_id = []
            results = results.map(item => {
                const sku_list = []
                data.forEach(list => {
                    if (item.old_sku === list.order_sku) {
                        list.img_id = list.img_id ? list.img_id.split(',')[0] : ''
                        if (list.img_id) {
                            img_id.push(list.img_id)
                        }
                        sku_list.push(list)
                    }
                })
                item.sku_list = sku_list
                return item
            })
            const sql = `select id,url,name from pictrue_info where id in ('${img_id.join("','")}')`
            db.query(sql, (err, img_list) => {
                if (err) return res.cc(err)
                results = results.map(item => {
                    if (item.sku_list) {
                        item.sku_list = item.sku_list.map(list => {
                            const img = img_list.find(img => img.id == list.img_id)
                            return {
                                ...list,
                                img_list: img ? img : {},
                                dangerous_goods: list.dangerous_goods ? list.dangerous_goods : 'D01'
                            }
                        })
                    }
                    return item
                })
                res.send({
                    code: 200,
                    message: '获取sku信息成功',
                    data: results
                })
            })
        })
    })
}