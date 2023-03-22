const request = require('request');
const moment = require('moment')
const execTransection = require('../commom/execTransection')
const db = require('../db/index')
const async = require('async');
let retryTime = 0

/**
 * shopline生成token方法
 * @param {店铺名} handle 
 */
async function getOrder(element, cb) {
    const { shopline_name } = element
    try {
        await getData(element).then(data => {
            retryTime = 0
            console.log('店铺' + shopline_name + '请求成功')
            const sql = `select i.user from shopline_info i where i.shopline_name='${shopline_name}'`

            if (data.orders) {
                db.query(sql, (err, results) => {
                    if (err) return reject(err)
                    console.log('更新订单数：' + data.orders.length)
                    console.log('最新订单id：' + data.orders[data.orders.length - 1].id)
                    orderDeal(data, shopline_name, results[0].user, cb)
                })
            } else {
                cb()
            }
        }).catch(err => {
            retryTime++
            if (err.code === 'request' && retryTime < 10) {
                console.log('请求' + shopline_name + '订单接口失败，再次请求')
                getOrder(element, cb)
            } else if (err.code === 'request' && retryTime >= 10) {
                console.log('重复请求' + shopline_name + '订单接口次数超过10次，停止请求')
                retryTime = 0
                cb()
            } else {
                retryTime = 0
                console.log(err)
            }
        })
    } catch (error) {
        retryTime = 0
        console.log(error)
    }
}
const getData = (element) => {
    const { shopline_name, token, since_id } = element
    const url = `https://${shopline_name}.myshopline.com/admin/openapi/v20220901/orders.json`
    // const updated_at_min = synchronization_time ? synchronization_time.replace(new RegExp(" ", "gm"), "T") + '+08:00' : '2000-01-01T23:59:59+08:00'
    // const updated_at_max = moment(new Date()).format('YYYY-MM-DD HH:mm:ss').replace(new RegExp(" ", "gm"), "T") + '+08:00'
    return new Promise((resolve, reject) => {
        request({
            timeout: 10000,   // 设置超时
            headers: {
                Authorization: 'Bearer ' + token
            },
            method: 'GET',   //请求方式
            url,//url
            json: true,
            qs: {
                financial_status: 'paid',
                // updated_at_min,
                // updated_at_max,
                since_id,
                limit: 100
            }
        }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                resolve(body)
            } else {
                reject({ code: 'request' })
            }
        });
    })
}

const orderDeal = (data, shopline_name, user_id, cb) => {
    let task = [];
    let async_lists = []
    data.orders.forEach(element => {
        const { id } = element
        //检查该订单是否已被录入
        const checkOrderSql = `select 1 from order_info i where i.id='${id}' limit 1`
        task.push((callback) => {
            db.query(checkOrderSql, (err, results) => {
                if (err) return res.cc(err)
                //若数据库中不包含该订单，则执行录入操作
                if (!results[0]) {
                    async_lists.push(id)
                    insertOrder(shopline_name, id, element, user_id, callback)
                }
            })
        })
    })
    async.waterfall(task, function (err, result) {
        if (err) {
            console.log(err);
        }
        cb()
        console.log('完成')
    })
}

const insertOrder = (shopline_name, id, element, user_id, callback) => {
    //批量检查sku是否存在
    const sku_array = ['BD20221001YFX']
    let sku_all_string = ['BD20221001YFX']
    element.line_items.forEach((m) => {
        if (m.sku) {
            m.sku.split('+').forEach(g => {
                const sku = g.split('*')[0]
                if (!sku_array.includes(sku)) {
                    sku_array.push(sku)
                    sku_all_string.push(sku)
                }
            })
        }
    })
    const sku_string = sku_array.join("','")
    const created_at = moment(element.created_at ? editTime(element.created_at) : new Date()).format('YYYY-MM-DD')
    const checkSkuSql = `select i.sku_goods_id,i.name_cn,i.purchase_ref_price,i.weight,i.length,i.wide,i.height,j.dangerous_goods from sku_goods_info i join sku_customs_info j on i.sku_goods_id=j.sku_goods_id where i.sku_goods_id in ('${sku_string}')`
    const getGrossMarginSql = `select i.* from gross_margin_table i where i.sku_goods_id in ('${sku_all_string.join("','")}') and i.calculate_date = '${created_at}' and i.user_id='${user_id}'`
    const exchangeRateSql = `select i.* from sku_parameter i where i.date = '${created_at}'`
    const shoplineInfoSql = `select i.user from shopline_info i where i.shopline_name = '${shopline_name}'`
    const changeShoplineInfoSql = `update shopline_info set since_id='${id}' where shopline_name='${shopline_name}'`    //将shopline_info内since_id更新
    const dailyGrossMarginSql = `select i.total from daily_gross_margin i where i.calculate_date = '${created_at}'`
    //检查当前订单的商品是否存在系统的商品信息内
    const p1 = new Promise((resolve, reject) => {
        db.query(checkSkuSql, (err, results) => {
            if (err) return reject(err)
            resolve(results)
        })
    })
    //获取当前订单时间的毛利参数
    const p2 = new Promise((resolve, reject) => {
        db.query(exchangeRateSql, (err, results) => {
            if (err) return reject(err)
            resolve(results)
        })
    })
    //获取当前订单对应的毛利信息
    const p3 = new Promise((resolve, reject) => {
        db.query(getGrossMarginSql, (err, results) => {
            if (err) return reject(err)
            resolve(results)
        })
    })
    //获取当前店铺对应的归属人
    const p4 = new Promise((resolve, reject) => {
        db.query(shoplineInfoSql, (err, results) => {
            if (err) return reject(err)
            resolve(results)
        })
    })
    //获取当前店铺对应的归属人
    const p5 = new Promise((resolve, reject) => {
        db.query(dailyGrossMarginSql, (err, results) => {
            if (err) return reject(err)
            resolve(results)
        })
    })
    Promise.all([p1, p2, p3, p4, p5]).then(resultsArr => {
        const results = resultsArr[0]   //商品信息
        const parameterInfo = resultsArr[1][0]  //当天参数信息
        const GrossMarginArr = resultsArr[2]    //毛利信息
        const shoplineInfo = resultsArr[3][0]    //店铺信息
        const dailyGrossMarginInfo = resultsArr[4][0]    //店铺信息

        //获取sku库
        const sku_occur = []
        results.forEach(m => {
            if (!sku_occur.includes(m.sku_goods_id)) {
                sku_occur.push(m.sku_goods_id)
            }
        })
        //录入order_info
        const order_info_sql = `insert into order_info set ?`
        const order_info_array = ['id', 'user_id', 'exchangeRate', 'shop_name', 'buyer_note', 'contract_seq', 'currency', 'current_subtotal_price', 'current_total_discounts', 'current_total_price', 'current_total_tax', 'customer_locale', 'deduct_member_point_amount', 'email', 'financial_status', 'hidden_order', 'landing_site', 'name', 'order_at', 'order_status_url', 'payment_gateway_names', 'phone', 'presentment_currency', 'referring_site', 'referring_site', 'source_identifier', 'source_name', 'source_url', 'status', 'order_status', 'store_id', 'subtotal_price', 'tags', 'taxes_included', 'tax_number', 'tax_type', 'total_discounts', 'total_line_items_price', 'total_outstanding', 'total_tax', 'total_tip_received', 'total_weight', 'updated_at', 'created_at', 'utm_parameters']
        const order_info = {}
        element.order_status = '1'
        element.shop_name = shopline_name
        element.exchangeRate = parameterInfo.exchangeRate
        element.payment_gateway_names = element.payment_gateway_names.join(',')

        //录入shopline_customer_info
        const shopline_customer_info_array = ['id', 'address1', 'address2', 'city', 'country', 'country_code', 'first_name', 'last_name', 'name', 'phone', 'province', 'province_code', 'zip', 'area_code', 'created_at', 'currency', 'email', 'updated_at']
        const shopline_customer_info_string = shopline_customer_info_array.join(',')
        let value_string = ``
        shopline_customer_info_array.forEach(key => {
            if (key !== 'id') {
                value_string = value_string + key + '=VALUES(' + key + '),'
            }
        })
        value_string = value_string.slice(0, value_string.length - 1)
        const shopline_customer_info_sql = `insert into shopline_customer_info (${shopline_customer_info_string})values (?) on duplicate key update ${value_string}`
        const shopline_customer_info_obj = {
            ...element.customer,
            ...element.customer.addresses
        }
        shopline_customer_info_obj.created_at = editTime(shopline_customer_info_obj.created_at)
        shopline_customer_info_obj.updated_at = editTime(shopline_customer_info_obj.updated_at)
        const shopline_customer_info = []
        shopline_customer_info_array.forEach(key => {
            shopline_customer_info.push(shopline_customer_info_obj[key])
        })

        //录入fulfillments_info
        const fulfillments_info = []
        const fulfillments_info_array = ['id', 'created_at', 'order_id', 'shipment_status', 'status', 'tracking_company', 'tracking_number', 'tracking_url', 'updated_at']
        const fulfillments_info_string = fulfillments_info_array.join(",")
        let fulfillments_info_sql = `insert into fulfillments_info (${fulfillments_info_string})values ?`
        //录入line_items，需要判断是否包含在商品表内，进行标记
        const line_items_array = ['id', 'order_id', 'sku_status', 'attribute', 'fulfillable_quantity', 'fulfillment_service', 'fulfillment_status', 'grams', 'image_url', 'location_id', 'name', 'price', 'product_id', 'quantity', 'requires_shipping', 'sku', 'old_sku', 'variant_id', 'variant_title', 'vendor', 'title', 'gift_card', 'date', 'user', 'businessVolume', 'major']
        const line_items_string = line_items_array.join(",")
        let line_items_value_string = ``
        line_items_array.forEach(key => {
            if (key !== 'id' && key !== 'order_id') {
                line_items_value_string = line_items_value_string + key + '=(' + key + '),'
            }
        })
        line_items_value_string = line_items_value_string.slice(0, line_items_value_string.length - 1)
        let line_items_sql = `insert into line_items (${line_items_string})values ? on duplicate key update ${line_items_value_string}`
        const line_items = []
        //判断sku是否存在并录入gross_margin_table中
        const gross_margin_table = []
        const gross_margin_table_array = ['id', 'calculate_date', 'user_id', 'sku_goods_id', 'name_cn', 'salesVolume', 'orderQuantity', 'businessVolume', 'gramPrice']
        const gross_margin_table_string = gross_margin_table_array.join(",")
        //录入match_sku
        const match_sku = []
        const match_sku_array = ['order_sku', 'sku', 'date', 'quantity', 'user', 'seq']
        const match_sku_string = match_sku_array.join(",")
        let match_sku_sql = `select 1 from dual`
        // let match_sku_sql = `insert into match_sku (${match_sku_string})values ? on duplicate key update quantity=VALUES(quantity)`
        //录入商品信息
        let orderQuantity = 1
        element.line_items.forEach((m, index) => {
            line_items.push([])
            m.order_id = element.id
            m.sku_status = '1'
            m.old_sku = m.sku
            m.date = created_at
            m.user = shoplineInfo.user
            //将sku解析，先判断sku是否异常
            const sku_list = []
            if (m.sku && m.sku !== 'BD20221001YFX') {
                m.orderQuantity = orderQuantity
                orderQuantity = 0
                m.sku.split('+').forEach((sku, index) => {
                    const sku_goods_id = sku.split('*')[0]
                    // const quantity = sku.split('*')[1] ? sku.split('*')[1] : 1
                    if (sku_occur.includes(sku_goods_id)) {
                        sku_list.push(sku.split('*')[0])

                        match_sku_sql = `insert into match_sku (${match_sku_string})values ? on duplicate key update quantity=VALUES(quantity)`
                        match_sku.push([m.sku, sku.split('*')[0], created_at, sku.split('*')[1] ? sku.split('*')[1] : 1, shoplineInfo.user, index])
                    } else {
                        m.sku_status = '0'  //商品sku异常
                        element.order_status = '0'  //订单sku异常
                    }
                })
            } else if (m.sku === 'BD20221001YFX' || !m.sku) {
                m.sku = 'BD20221001YFX'
                m.old_sku = 'BD20221001YFX'
                m.name_cn = '运费险'
                m.orderQuantity = 0
                match_sku_sql = `insert into match_sku (${match_sku_string})values ? on duplicate key update quantity=VALUES(quantity)`
                match_sku.push([m.sku, m.sku, created_at, 1, shoplineInfo.user, 0])
            } else {
                m.sku_status = '0'  //商品sku异常 
                element.order_status = '0'  //订单sku异常
            }

            // 通过将current_total_price进行除运费险外的等比例划分，添加进毛利信息
            let businessVolume = m.price
            if (m.sku !== 'BD20221001YFX') {
                //先将运费险从current_subtotal_price中扣除
                const YFX_price = element.line_items.find(item => item.sku === 'BD20221001YFX' || !item.sku) ? element.line_items.find(item => item.sku === 'BD20221001YFX' || !item.sku).price : 0
                const current_subtotal_price = Number(element.current_subtotal_price) - Number(YFX_price)   //获得除运费险外的商品金额
                const price_rate = Number(m.price) * Number(m.quantity) / current_subtotal_price    //获得商品金额占订单金额比例
                businessVolume = price_rate * (Number(element.current_total_price) - Number(YFX_price))
            }
            m.businessVolume = businessVolume
            //若商品sku正常，则将该订单填入数据库中
            if (m.sku_status === '1') {
                m.sku.split('+').forEach((sku, i) => {
                    const sku_goods_id = sku.split('*')[0]
                    const quantity = sku.split('*')[1] ? sku.split('*')[1] : 1
                    const sku_info = GrossMarginArr.find(item => item.sku_goods_id === sku_goods_id)
                    //回显毛利表名称跟危险品属性信息
                    const sku_index = results.findIndex(item => item.sku_goods_id === sku_goods_id)
                    const { dangerous_goods, name_cn } = results[sku_index]
                    let gross_businessVolume = 0
                    let gross_orderQuantity = 0
                    if (sku_info && !i) {
                        gross_businessVolume = (Number(sku_info.businessVolume) + Number(m.businessVolume)).toFixed(2)
                        gross_orderQuantity = Number(sku_info.orderQuantity) + m.orderQuantity
                    } else if (sku_info && i) {
                        gross_businessVolume = sku_info.businessVolume
                        gross_orderQuantity = sku_info.orderQuantity
                    } else if (!sku_info && !i) {
                        gross_businessVolume = m.businessVolume
                        gross_orderQuantity = m.orderQuantity
                    }
                    //将毛利表的数据处理后填入
                    gross_margin_table.push([
                        sku_info ? sku_info.id : null,
                        created_at,
                        shoplineInfo.user,
                        sku_goods_id,
                        name_cn,
                        sku_info ? Number(sku_info.salesVolume) + Number(m.quantity) * Number(quantity) : Number(m.quantity) * Number(quantity),
                        gross_orderQuantity,
                        gross_businessVolume,
                        sku_info && sku_info.gramPrice ? sku_info.gramPrice : parameterInfo[dangerous_goods ? dangerous_goods : 'D01']
                    ])
                })
            }

            m.major = m.orderQuantity   //是否为主商品
            line_items_array.forEach(key => {
                line_items[index].push(m[key])
            })
        })
        //判断是否有包裹信息
        if (element.fulfillments.length) {
            element.fulfillments.forEach((t, index) => {
                fulfillments_info.push([])
                t.order_id = element.id //获取订单id
                fulfillments_info_array.forEach(key => {
                    fulfillments_info[index].push(t[key])
                })
            })
        } else {
            fulfillments_info_sql = 'select 1 from dual'
        }
        //订单信息填入
        order_info_array.forEach(key => {
            order_info[key] = element[key]
        })
        order_info.created_at = editTime(order_info.created_at)
        order_info.updated_at = editTime(order_info.updated_at)
        order_info.order_at = editTime(order_info.order_at)

        //录入daily_gross_margin每日毛利信息
        let daily_gross_margin_sql = `insert into daily_gross_margin (calculate_date,user_id,total)values ? on duplicate key update total=VALUES(total)`
        const daily_gross_margin = [[
            created_at,
            shoplineInfo.user,
            dailyGrossMarginInfo ? Number(dailyGrossMarginInfo.total) + gross_margin_table.length : gross_margin_table.length
        ]]

        let gross_margin_table_del_sql = `select 1 from dual`
        let gross_margin_table_ins_sql = `insert into gross_margin_table (${gross_margin_table_string})values ? on duplicate key update salesVolume=VALUES(salesVolume),orderQuantity=VALUES(orderQuantity),businessVolume=VALUES(businessVolume)`
        // let gross_margin_table_ins_sql = `insert into gross_margin_table (${gross_margin_table_string})values ?`
        //判断是否毛利表有数据更新，否则不做操作
        if (!gross_margin_table.length) {
            gross_margin_table_del_sql = `select 1 from dual`
            gross_margin_table_ins_sql = 'select 1 from dual'
        }
        //录入payment_details
        const payment_details_array = ['pay_seq', 'create_time', 'pay_amount', 'pay_channel', 'pay_channel_deal_id', 'pay_merchant_email', 'pay_merchant_id', 'pay_merchant_order_id', 'pay_status', 'order_id']
        const payment_details_string = payment_details_array.join(",")
        const payment_details_sql = `insert into payment_details (${payment_details_string})values ?`
        const payment_details = []
        element.payment_details.forEach((t, index) => {
            payment_details.push([])
            t.order_id = element.id //获取订单id
            t.create_time = editTime(t.create_time)
            payment_details_array.forEach(key => {
                payment_details[index].push(t[key])
            })
        })
        //录入shipping_address
        const shipping_address = {}
        const shipping_address_array = ['address1', 'address2', 'city', 'company', 'country', 'country_code', 'delivery_store_code', 'delivery_store_name', 'district', 'district_code', 'first_name', 'last_name', 'latitude', 'longitude', 'name', 'phone', 'province', 'province_code', 'zip', 'area_code', 'created_at', 'currency', 'email', 'updated_at']
        shipping_address_array.forEach(key => {
            shipping_address[key] = element.shipping_address[key]
        })
        shipping_address.order_id = element.id
        shipping_address.created_at = editTime(shipping_address.created_at)
        shipping_address.updated_at = editTime(shipping_address.updated_at)
        const shipping_address_sql = `insert into shipping_address set ?`
        //录入shipping_lines，因为code有可能为空
        const shipping_lines_array = ['code', 'order_id', 'discounted_price', 'phone', 'price', 'requested_fulfillment_service_id', 'source', 'title']
        const shipping_lines_string = shipping_lines_array.join(",")
        const shipping_lines_sql = `insert into shipping_lines (${shipping_lines_string})values ?`
        const shipping_lines = []
        element.shipping_lines.forEach((t, index) => {
            shipping_lines.push([])
            t.order_id = element.id //获取订单id
            shipping_lines_array.forEach(key => {
                shipping_lines[index].push(t[key])
            })
        })
        execTransection([
            {
                sql: order_info_sql,
                values: order_info
            },
            {
                sql: shopline_customer_info_sql,
                values: [shopline_customer_info]
            },
            {
                sql: fulfillments_info_sql,
                values: [fulfillments_info]
            },
            {
                sql: line_items_sql,
                values: [line_items]
            },
            {
                sql: payment_details_sql,
                values: [payment_details]
            },
            {
                sql: shipping_address_sql,
                values: shipping_address
            },
            {
                sql: shipping_lines_sql,
                values: [shipping_lines]
            },
            // {
            //     sql: gross_margin_table_del_sql,
            //     values: []
            // },
            {
                sql: gross_margin_table_ins_sql,
                values: [gross_margin_table]
            },
            {
                sql: changeShoplineInfoSql,
                values: []
            },
            {
                sql: daily_gross_margin_sql,
                values: [daily_gross_margin]
            },
            {
                sql: match_sku_sql,
                values: [match_sku]
            },
        ]).then(resp => {
            console.log(`订单${id}已保存至数据库`)
            callback()
        }).catch(err => {
            console.log(err)
        })
    })
}

//对时间进行转换
const editTime = (time) => {
    let date = time ? time.replace(new RegExp("T", "gm"), " ").slice(0, 19) : null
    return date
}

module.exports = getOrder;