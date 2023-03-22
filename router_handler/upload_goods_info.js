// 导入数据库操作模块
const db = require('../db/index')
const execTransection = require('../commom/execTransection')
const moment = require('moment')
const excelAnalysis = require("../commom/excelAnalysis")
var mysql = require('mysql')

exports.uploadExcel = (req, res) => {
    const array = [
        //sku_goods_info
        'sku_goods_id',
        'old_spu',  //废弃
        'Identification_code',
        'platform_sku',
        'name_cn',
        'name_en',
        'goods_classify',
        'sales_method',
        'status',   //参数
        'img_url',//图片
        'source_url',
        'weight',
        'length',
        'wide',
        'height',
        'goods_info_remark',
        'insert_time',
        'developer', //参数
        'weighting_error',

        //sku_customs_info
        'declare_en',
        'declare_cn',
        'declare_weight',
        'declare_price',
        'dangerous_goods', //参数
        'material_quality',
        'purpose',
        'customs_id',

        //sku_goods_info
        'purchase_ref_price',
        'purchaser',
        // update_time
        // goods_classify

        //sku_warehouse_info
        //'warehouse_location',   //参数
    ]
    const parameter = {
        status: [
            { key: 'A01', name: '在售' },
            { key: 'A02', name: '热销' },
            { key: 'A03', name: '新品' },
            { key: 'A04', name: '清仓' },
            { key: 'A05', name: '停售' }
        ],
        dangerous_goods: [
            // { key: 'D01', name: '无' },
            // { key: 'D02', name: '含电（内电）' },
            // { key: 'D03', name: '纯电' },
            // { key: 'D04', name: '液体（特货）' },
            // { key: 'D05', name: '粉末（特货）' },
            // { key: 'D06', name: '膏体（特货）' },
            // { key: 'D07', name: '带磁(特货)' },
            // { key: 'D08', name: '含非液体化妆品' }
            { key: 'D01', name: '0' },
            { key: 'D02', name: '1' },
            { key: 'D03', name: '4' },
            { key: 'D04', name: '2' },
            { key: 'D05', name: '3' },
            { key: 'D06', name: '5' },
            { key: 'D07', name: '6' },
            { key: 'D08', name: '7' }
        ],
    }
    //获取用户信息
    const p1 = new Promise((resolve, reject) => {
        const getUserSql = `select i.id,i.nickname,i.department from users i`
        db.query(getUserSql, (err, results) => {
            if (err) {
                reject()
                return res.cc(err)
            }
            resolve(results)
        })
    })
    //获取sku商品信息
    const p2 = new Promise((resolve, reject) => {
        const getSkuSql = `select i.sku_goods_id from sku_goods_info i`
        db.query(getSkuSql, (err, results) => {
            if (err) {
                reject()
                return res.cc(err)
            }
            resolve(results)
        })
    })
    //获取分类信息
    const p3 = new Promise((resolve, reject) => {
        const sql = `select i.id,i.classifyType from classify_info i`
        db.query(sql, (err, results) => {
            if (err) {
                reject()
                return res.cc(err)
            }
            resolve(results)
        })
    })
    //获取spu列表信息
    const p4 = new Promise((resolve, reject) => {
        const sql = `select * from spu_info`
        db.query(sql, (err, results) => {
            if (err) {
                reject()
                return res.cc(err)
            }
            resolve(results)
        })
    })
    Promise.all([p1, p2, p3, p4]).then(results => {
        parameter.purchaser = results[0].map(list => {
            return {
                key: list.id,
                name: list.nickname
            }
        })
        parameter.developer = results[0].map(list => {
            return {
                key: list.id,
                name: list.nickname
            }
        })
        const current_spu_list = results[3]
        const classify_info_data = results[2]
        excelAnalysis(req).then(({ fields, file }) => {
            const allData = []
            let occupy_num = 0
            for (let index = 0; index < file[0].data.length; index++) {
                const element = file[0].data[index];
                //第一二行没有数据
                if (index === 0) continue
                //判断是否已经包含在数据库内
                const is_occupy = results[1].findIndex(item => item.sku_goods_id === element[0])
                if (is_occupy !== -1) {
                    occupy_num++
                    continue
                }
                //赋值
                let list = {}
                array.forEach((key, i) => {
                    if (parameter[key]) {
                        const value = parameter[key].find(data => data.name == element[i])
                        list[key] = value ? value.key : ''
                    } else {
                        list[key] = element[i]
                    }
                })

                //获取插入时间，sku的分类信息在插入时间前面
                list.goods_classify = list.goods_classify.split(' - ')[1]
                list.sales_method = 'goods'
                list.spu = list.sku_goods_id.split('-')[0]

                // 先判断分类信息是否存在分类信息表中
                const classify_list = classify_info_data.find(item => item.classifyType === list.goods_classify)
                if (classify_list) {
                    list.goods_classify = classify_list.id
                } else {
                    occupy_num++
                    continue
                }

                allData.push(list)
            }

            //将图片信息保存
            if (allData.length === 0) {
                res.send({
                    code: 200,
                    message: '导入商品信息成功！',
                    data: {
                        occupy_num,
                        insert_num: allData.length
                    }
                })
            } else {
                saveImg(allData).then(data_list => {
                    //提取出spu信息
                    const spu_info = []
                    let del_spu_list = []
                    for (let index = 0; index < data_list.length; index++) {
                        const item = data_list[index];
                        const spu = item.spu
                        item.update_time = moment(new Date()).format('YYYY-MM-DD HH:mm:ss')
                        //判断该spu是否已存在于数据中，并且不是二次添加，是则将数据库内的数据导出，并添加至待删除列表
                        const current_spu_info = current_spu_list.find(list => list.spu === spu)
                        if (current_spu_info && !del_spu_list.includes(spu)) {
                            spu_info.push(current_spu_info)
                            del_spu_list.push(spu)
                        }

                        //判断该spu是否已存在，若存在则不进行添加
                        const have_spu_index = spu_info.findIndex(list => list.spu === spu)

                        if (have_spu_index !== -1) {
                            spu_info[have_spu_index].sku_list = spu_info[have_spu_index].sku_list + ',' + item.sku_goods_id
                            spu_info[have_spu_index].sku_list_number++
                        } else {
                            let list = {
                                spu,
                                goods_classify: item.goods_classify,
                                sales_method: item.sales_method,
                                img_id: item.img_id,
                                warehouse_location: 'W01',
                                purchaser: item.purchaser,
                                developer: item.developer,
                                sku_list: item.sku_goods_id,
                                sku_list_number: 1,
                                insert_time: item.insert_time,
                                update_time: item.update_time
                            }
                            spu_info.push(list)
                        }
                    }

                    //将数据库内不存在的数据插入数据库
                    insertGoods({ sku_list: data_list, spu_list: spu_info, del_spu_list }).then(() => {
                        res.send({
                            code: 200,
                            message: '导入商品信息成功！',
                            data: {
                                occupy_num,
                                insert_num: data_list.length
                            }
                        })
                    }).catch((err) => {
                        res.cc(err)
                    })
                })
            }
        })
    })
}

function saveImg(allData) {
    let list = []
    allData.forEach(element => {
        const name_list = element.img_url.split('/')
        list.push([
            element.img_url,
            name_list[name_list.length - 1],
            element.sku_goods_id
        ])
    })
    const sql = `insert into pictrue_info (url,name,sku_goods_id)values ?`
    return new Promise((resolve, reject) => {
        db.query(sql, [list], (err, results) => {
            if (err) {
                reject(err)
                return
            }
            const list = []
            for (let index = 0; index < allData.length; index++) {
                list.push({
                    ...allData[index],
                    img_id: results.insertId + index
                })
            }
            resolve(list)
        })
    })
}
function insertGoods(data) {
    const spu_info_array = []
    data.spu_list.forEach(res => {
        spu_info_array.push([
            res.spu,
            res.goods_classify,
            res.sales_method,
            res.img_id,
            res.warehouse_location,
            res.purchaser,
            res.developer,
            res.sku_list,
            res.sku_list_number,
            res.insert_time,
            res.update_time
        ])
    })
    const sku_warehouse_info_array = []
    data.sku_list.forEach(res => {
        sku_warehouse_info_array.push([
            res.sku_goods_id,
            res.warehouse_location,
            res.spu,
        ])
    })
    const sku_goods_info_array = []
    data.sku_list.forEach(res => {
        sku_goods_info_array.push([
            res.sku_goods_id,
            res.platform_sku,
            res.Identification_code,
            res.name_cn,
            res.status,
            res.img_id,
            res.weight,
            res.purchase_ref_price,
            res.purchaser,
            res.developer,
            res.weighting_error,
            res.name_en,
            res.length,
            res.wide,
            res.height,
            res.source_url,
            res.goods_info_remark,
            res.insert_time,
            res.update_time,
            res.sales_method,
            res.goods_classify
        ])
    })
    const sku_customs_info_array = []
    data.sku_list.forEach(res => {
        sku_customs_info_array.push([
            res.sku_goods_id,
            res.declare_en,
            res.declare_cn,
            res.declare_weight,
            res.declare_price,
            res.dangerous_goods,
            res.material_quality,
            res.purpose,
            res.customs_id
        ])
    })
    const del_spu_list = data.del_spu_list.join("','")
    return new Promise((resolve, reject) => {
        execTransection([
            {
                sql: `delete from spu_info where spu in ('${del_spu_list}')`,
                values: []
            },
            {
                sql: "insert into spu_info (spu,goods_classify,sales_method,img_id,warehouse_location,purchaser,developer,sku_list,sku_list_number,insert_time,update_time)values ?",
                values: [spu_info_array]
            },
            {
                sql: "insert into sku_customs_info (sku_goods_id,declare_en,declare_cn,declare_weight,declare_price,dangerous_goods,material_quality,purpose,customs_id)values ?",
                values: [sku_customs_info_array]
            },
            {
                sql: "insert into sku_goods_info (sku_goods_id,platform_sku,Identification_code,name_cn,status,img_id,weight,purchase_ref_price,purchaser,developer,weighting_error,name_en,length,wide,height,source_url,goods_info_remark,insert_time,update_time,sales_method,goods_classify)values ?",
                values: [sku_goods_info_array]
            }, {
                sql: "insert into sku_warehouse_info (sku_goods_id,warehouse_location,spu)values ?",
                values: [sku_warehouse_info_array]
            }]).then(resp => {
                resolve()
            }).catch(err => {
                console.log(err)
                reject(err)
            })
    })
}

exports.uploadWarehouseExcel = (req, res) => {
    const array = [
        //sku_warehouse_info
        'sku_goods_id',
        'warehouse_location',   //参数
        'shelf_location',
        'storage',
        'safe_storagere',
        'unit_price',
        'total_price',
        'purchase_in_transit',
        'warehouse_in_transit',
        'transferi_in_transit',
        'pre_sale',
        'available_inventory',
        'warehouse_remark',
        // spu

        //sku_goods_info
        'platform_sku',
        'old_spu',  //废弃
        'Identification_code',
        'name_cn',
        'status',   //参数
        'img_url',//图片
        'weight',
        'purchase_ref_price',
        'purchaser',    //参数
        'length',
        'wide',
        'height',
        'source_url',
        'goods_info_remark',

        //sku_customs_info
        'declare_en',
        'declare_cn',
        'declare_weight',
        'declare_price',
        'dangerous_goods_number',    //参数
        'material_quality',
        'purpose',
        'customs_id',

        //sku_goods_info
        'insert_time',
        'update_time',
        // sales_method
        // goods_classify
    ]
    const parameter = {
        warehouse_location: [{ key: 'W01', name: '默认仓库' }]
    }
    //获取sku商品信息
    const getSkuSql = `select i.sku_goods_id from sku_goods_info i`
    db.query(getSkuSql, (err, results) => {
        if (err) {
            return res.cc(err)
        }
        excelAnalysis(req).then(({ fields, file }) => {
            const allData = []
            let occupy_num = 0
            for (let index = 0; index < file[0].data.length; index++) {
                const element = file[0].data[index];
                //第一二行没有数据
                if (index === 0 || index === 1) continue
                //判断是否已经包含在数据库内,若存在才可以插入，不存在则不能插入
                const is_occupy = results.findIndex(item => item.sku_goods_id === element[0])
                if (is_occupy === -1) {
                    occupy_num++
                    continue
                }
                //赋值
                let list = {}
                array.forEach((key, i) => {
                    if (parameter[key]) {
                        const value = parameter[key].find(data => data.name === element[i])
                        list[key] = value ? value.key : ''
                    } else {
                        list[key] = element[i]
                    }
                })

                allData.push(list)
            }

            const sku_warehouse_info_array = []
            allData.forEach(res => {
                sku_warehouse_info_array.push([
                    res.sku_goods_id,
                    res.warehouse_location,
                    res.shelf_location,
                    res.storage,
                    res.safe_storagere,
                    res.unit_price,
                    res.total_price,
                    res.purchase_in_transit,
                    res.warehouse_in_transit,
                    res.transferi_in_transit,
                    res.pre_sale,
                    res.available_inventory,
                    res.warehouse_remark,
                ])
            })

            const sql = "insert into sku_warehouse_info (sku_goods_id,warehouse_location,shelf_location,storage,safe_storagere,unit_price,total_price,purchase_in_transit,warehouse_in_transit,transferi_in_transit,pre_sale,available_inventory,warehouse_remark)values ? on duplicate key update warehouse_location=VALUES(warehouse_location),shelf_location=VALUES(shelf_location),storage=VALUES(storage),safe_storagere=VALUES(safe_storagere),unit_price=VALUES(unit_price),total_price=VALUES(total_price),purchase_in_transit=VALUES(purchase_in_transit),warehouse_in_transit=VALUES(warehouse_in_transit),transferi_in_transit=VALUES(transferi_in_transit),pre_sale=VALUES(pre_sale),available_inventory=VALUES(available_inventory),warehouse_remark=VALUES(warehouse_remark)"

            db.query(sql, [sku_warehouse_info_array], (err, results) => {
                if (err) return res.cc(err)
                res.send({
                    code: 200,
                    message: '导入商品仓库信息成功！',
                    data: {
                        occupy_num,
                        insert_num: allData.length
                    }
                })
            })
        })
    })
}

exports.uploadAllExcel = (req, res) => {
    const array = [
        //sku_goods_info
        'sku_goods_id',
        'spu',
        'old_spu',  //废弃
        'Identification_code',
        'platform_sku',
        'name_cn',
        'name_en',
        'goods_classify',
        'sales_method',
        'status',   //参数
        'img_url',//图片
        'source_url',
        'weight',
        'length',
        'wide',
        'height',
        'goods_info_remark',
        'insert_time',
        'developer', //参数
        'weighting_error',

        //sku_customs_info
        'declare_en',
        'declare_cn',
        'declare_weight',
        'declare_price',
        'dangerous_goods', //参数
        'material_quality',
        'purpose',
        'customs_id',

        //sku_goods_info
        'purchase_ref_price',
        'purchaser',
        // update_time

        //sku_warehouse_info
        //'warehouse_location',   //参数
    ]
    const parameter = {
        status: [
            { key: 'A01', name: '在售' },
            { key: 'A02', name: '热销' },
            { key: 'A03', name: '新品' },
            { key: 'A04', name: '清仓' },
            { key: 'A05', name: '停售' }
        ],
        dangerous_goods: [
            { key: 'D01', name: '0' },
            { key: 'D02', name: '1' },
            { key: 'D03', name: '4' },
            { key: 'D04', name: '2' },
            { key: 'D05', name: '3' },
            { key: 'D06', name: '5' },
            { key: 'D07', name: '6' },
            { key: 'D08', name: '7' }
        ],
    }
    //获取用户信息
    const p1 = new Promise((resolve, reject) => {
        const getUserSql = `select i.id,i.nickname,i.department from users i`
        db.query(getUserSql, (err, results) => {
            if (err) {
                reject()
                return res.cc(err)
            }
            resolve(results)
        })
    })
    //获取sku商品信息
    const p2 = new Promise((resolve, reject) => {
        const getSkuSql = `select i.sku_goods_id from sku_goods_info i`
        db.query(getSkuSql, (err, results) => {
            if (err) {
                reject()
                return res.cc(err)
            }
            resolve(results)
        })
    })
    //获取分类信息
    const p3 = new Promise((resolve, reject) => {
        const sql = `select i.id,i.classifyType from classify_info i`
        db.query(sql, (err, results) => {
            if (err) {
                reject()
                return res.cc(err)
            }
            resolve(results)
        })
    })
    //获取spu列表信息
    const p4 = new Promise((resolve, reject) => {
        const sql = `select * from spu_info`
        db.query(sql, (err, results) => {
            if (err) {
                reject()
                return res.cc(err)
            }
            resolve(results)
        })
    })
    Promise.all([p1, p2, p3, p4]).then(results => {
        parameter.purchaser = results[0].map(list => {
            return {
                key: list.id,
                name: list.nickname
            }
        })
        parameter.developer = results[0].map(list => {
            return {
                key: list.id,
                name: list.nickname
            }
        })
        const current_spu_list = results[3]
        const classify_info_data = results[2]
        excelAnalysis(req).then(({ fields, file }) => {
            const allData = []
            let occupy_num = 0
            for (let index = 0; index < file[0].data.length; index++) {
                const element = file[0].data[index];
                //第一行没有数据
                if (index === 0) continue
                //判断是否已经包含在数据库内
                const is_occupy = results[1].findIndex(item => item.sku_goods_id === element[0])
                if (is_occupy !== -1) {
                    occupy_num++
                    continue
                }
                //赋值
                let list = {}
                array.forEach((key, i) => {
                    if (parameter[key]) {
                        const value = parameter[key].find(data => data.name == element[i])
                        list[key] = value ? value.key : ''
                    } else {
                        list[key] = element[i]
                    }
                })

                //获取插入时间，sku的分类信息在插入时间前面
                list.goods_classify = list.goods_classify.split(' - ')[1]
                list.sales_method = 'goods'

                // 先判断分类信息是否存在分类信息表中
                const classify_list = classify_info_data.find(item => item.classifyType === list.goods_classify)
                if (classify_list) {
                    list.goods_classify = classify_list.id
                } else {
                    occupy_num++
                    continue
                }

                allData.push(list)
            }

            //更新危险品数据
            // let dangerousSql = `UPDATE sku_customs_info SET dangerous_goods = CASE sku_goods_id`
            // let sku_goods_id_string = []
            // allData.forEach(item=>{
            //     dangerousSql=dangerousSql+` when '${item.sku_goods_id}' then '${item.dangerous_goods}'`
            //     sku_goods_id_string.push(item.sku_goods_id)
            // })
            // sku_goods_id_string=sku_goods_id_string.join("','")
            // dangerousSql= dangerousSql+` end where sku_goods_id in ('${sku_goods_id_string}')`
            // console.log(dangerousSql)
            //将图片信息保存
            if (allData.length === 0) {
                res.send({
                    code: 200,
                    message: '导入商品信息成功！',
                    data: {
                        occupy_num,
                        insert_num: allData.length
                    }
                })
            } else {
                saveImg(allData).then(data_list => {
                    //提取出spu信息
                    const spu_info = []
                    let del_spu_list = []
                    for (let index = 0; index < data_list.length; index++) {
                        const item = data_list[index];
                        const spu = item.spu
                        item.update_time = moment(new Date()).format('YYYY-MM-DD HH:mm:ss')
                        //判断该spu是否已存在于数据中，并且不是二次添加，是则将数据库内的数据导出，并添加至待删除列表
                        const current_spu_info = current_spu_list.find(list => list.spu === spu)
                        if (current_spu_info && !del_spu_list.includes(spu)) {
                            spu_info.push(current_spu_info)
                            del_spu_list.push(spu)
                        }

                        //判断该spu是否已存在，若存在则不进行添加
                        const have_spu_index = spu_info.findIndex(list => list.spu === spu)

                        if (have_spu_index !== -1) {
                            spu_info[have_spu_index].sku_list = spu_info[have_spu_index].sku_list + ',' + item.sku_goods_id
                            spu_info[have_spu_index].sku_list_number++
                        } else {
                            let list = {
                                spu,
                                goods_classify: item.goods_classify,
                                sales_method: item.sales_method,
                                img_id: item.img_id,
                                warehouse_location: 'W01',
                                purchaser: item.purchaser,
                                developer: item.developer,
                                sku_list: item.sku_goods_id,
                                sku_list_number: 1,
                                insert_time: item.insert_time,
                                update_time: item.update_time
                            }
                            spu_info.push(list)
                        }
                    }

                    //将数据库内不存在的数据插入数据库
                    insertGoods({ sku_list: data_list, spu_list: spu_info, del_spu_list }).then(() => {
                        res.send({
                            code: 200,
                            message: '导入商品信息成功！',
                            data: {
                                occupy_num,
                                insert_num: data_list.length
                            }
                        })
                    }).catch((err) => {
                        res.cc(err)
                    })
                })
            }
        })
    })
}