// 导入数据库操作模块
const db = require('../db/index')
const execTransection = require('../commom/execTransection')
const findStrSubtringToStart = require('../commom/findStrSubtring')
const moment = require('moment')
var mysql = require('mysql')
const checkIdOccupy = require("../commom/checkIdOccupy")

//新增多属性商品
exports.addSpuInfo = (req, res) => {
    let { spu, goods_classify, warehouse_location, sales_method, img_id, developer, purchaser, sku_list } = req.body
    const insert_time = moment(new Date()).format('YYYY-MM-DD HH:mm:ss'), update_time = moment(new Date()).format('YYYY-MM-DD HH:mm:ss')
    let sku_customs_info = ''
    let sku_goods_info = ''
    let sku_warehouse_info = ''
    let sku_string = []
    const old_spu = spu
    checkIdOccupy(spu).then((obj) => {
        if (obj.isOccupy) {
            //该id被占用，重新替换新id
            const classifyType = spu.substring(0, 2)
            const department = spu[spu.length - 3]
            spu = classifyType + moment(new Date()).format('YYYYMMDD') + department + obj.id
        }
        sku_list.forEach(element => {
            //判断id是否被占用，对sku_goods_id进行改造
            if (obj.isOccupy) {
                element.sku_goods_id = element.sku_goods_id.replace(new RegExp(old_spu, "gm"), spu)
            }
            sku_string.push(element.sku_goods_id)
            //拿到所有数据
            const array = "sku_goods_id, declare_en, declare_cn, declare_weight, declare_price, dangerous_goods, material_quality, purpose, customs_id, platform_sku, Identification_code, name_cn, name_en, status, weight, purchase_ref_price, length, wide, height, weighting_error, source_url, goods_remark, sales_method, warehouse_location, shelf_location, storage, safe_storagere, unit_price, total_price, purchase_in_transit, warehouse_in_transit, transferi_in_transit, pre_sale, available_inventory, warehouse_remark".split(', ')
            array.forEach(key => {
                element[key] = element[key] || ''
            })
            let {
                sku_goods_id, declare_en, declare_cn, declare_weight, declare_price, dangerous_goods, material_quality, purpose, customs_id,//sku_customs_info
                platform_sku, Identification_code, name_cn, name_en, status, weight, purchase_ref_price, length, wide, height, weighting_error, source_url, goods_remark, sales_method,//sku_goods_id,img_id,goods_classify,insert_time,update_time - sku_goods_info
                shelf_location, storage, safe_storagere, unit_price, total_price, purchase_in_transit, warehouse_in_transit, transferi_in_transit, pre_sale, available_inventory, warehouse_remark//spu,sku_goods_id - sku_warehouse_info
            } = element
            const img_id = element.imgId || ''

            let sku_customs_info_sqls = `insert into sku_customs_info(sku_goods_id,declare_en,declare_cn,declare_weight,declare_price,dangerous_goods,material_quality,purpose,customs_id)values("${sku_goods_id}","${declare_en}","${declare_cn}","${declare_weight}","${declare_price}","${dangerous_goods}","${material_quality}","${purpose}","${customs_id}")`
            let sku_goods_info_sqls = `insert into sku_goods_info(platform_sku,Identification_code,name_cn,name_en,status,weight,purchase_ref_price,purchaser,developer,length,wide,height,weighting_error,source_url,goods_remark,sales_method,sku_goods_id,img_id,goods_classify,insert_time,update_time)values("${platform_sku}","${Identification_code}","${name_cn}","${name_en}","A01","${weight}","${purchase_ref_price}","${purchaser}","${developer}","${length}","${wide}","${height}","${weighting_error}","${source_url}","${goods_remark}","${sales_method}","${sku_goods_id}","${img_id}","${goods_classify}","${insert_time}","${update_time}")`
            let sku_warehouse_info_sqls = `insert into sku_warehouse_info(warehouse_location,shelf_location,storage,safe_storagere,unit_price,total_price,purchase_in_transit,warehouse_in_transit,transferi_in_transit,pre_sale,available_inventory,warehouse_remark,spu,sku_goods_id)values("${warehouse_location}","${shelf_location}","${storage}","${safe_storagere}","${unit_price}","${total_price}","${purchase_in_transit}","${warehouse_in_transit}","${transferi_in_transit}","${pre_sale}","${available_inventory}","${warehouse_remark}","${spu}","${sku_goods_id}")`

            sku_customs_info += mysql.format(sku_customs_info_sqls, element) + ';'
            sku_goods_info += mysql.format(sku_goods_info_sqls, element) + ';'
            sku_warehouse_info += mysql.format(sku_warehouse_info_sqls, element) + ';'
        });

        const spu_info = {
            spu, goods_classify, sales_method, img_id, developer, purchaser, sku_list: sku_string.join(','), sku_list_number: sku_list.length, insert_time, update_time, warehouse_location
        }

        execTransection([{
            sql: `insert into spu_info set ?`,
            values: spu_info
        },
        {
            sql: sku_customs_info,
            values: []
        },
        {
            sql: sku_goods_info,
            values: []
        },
        {
            sql: sku_warehouse_info,
            values: []
        },
        {
            sql: `update daily_id_list set is_occupy=1 where index_spu_id='${obj.id}'`,
            values: []
        }
        ]).then(resp => {
            res.send({
                code: 200,
                message: '新增多属性商品成功！',
                data: {}
            })
        }).catch(err => {
            console.log(err)
            res.cc('新增多属性商品失败！')
        })
    })
}

//获取多属性商品信息，用于修改使用
exports.getSpuInfo = (req, res) => {
    const { spu } = req.body
    const sql1 = `SELECT i.*,j.classifyName,j.classifyType,n.url FROM spu_info i join classify_info j on i.goods_classify=j.id left join pictrue_info n on i.img_id=n.id where i.spu='${spu}'`
    db.query(sql1, (err, results1) => {
        if (err) return res.cc(err)
        const sku_list = results1[0].sku_list.split(',').join("','")
        const sql2 = `select i.*,j.*,n.* from sku_warehouse_info i join sku_goods_info j on i.sku_goods_id=j.sku_goods_id join sku_customs_info n on i.sku_goods_id=n.sku_goods_id where i.sku_goods_id in ('${sku_list}')`
        db.query(sql2, (err, results2) => {
            if (err) return res.cc(err)
            let imgList = ""
            results2.forEach((list) => {
                if (list.img_id) {
                    imgList = imgList + "," + list.img_id
                }
            })
            imgList = imgList.slice(1) || null
            const sql3 = `select i.id,i.url from pictrue_info i where i.id in (${imgList})`
            db.query(sql3, (err, results3) => {
                if (err) return res.cc(err)
                results2 = results2.map(list => {
                    list.img_list = []
                    const img_id_list = list.img_id.split(',')
                    img_id_list.forEach(id => {
                        list.img_list.push(results3.find(img => img.id == id) ? results3.find(img => img.id == id).url : '')
                    })
                    return list
                })
                res.send({
                    code: 200,
                    message: '获取商品信息成功！',
                    data: {
                        ...results1[0],
                        skuList: results2
                    }
                })
            })
        })
    })
}

//查询多属性商品列表
exports.searchSpuInfo = (req, res) => {
    const { sku_list, spu_list, name_cn, spu, sku_goods_id, goods_classify, developer } = req.body
    let pageNum = (req.body.pageNum == undefined) ? 1 : Number(req.body.pageNum);
    let pageSize = (req.body.pageSize == undefined) ? 10 : Number(req.body.pageSize);
    let startPage = (pageNum - 1) * pageSize;
    let sql = `SELECT i.*,j.classifyName,j.classifyType,n.url FROM spu_info i join classify_info j on i.goods_classify=j.id left join pictrue_info n on i.img_id=n.id where 1=1 `
    //查询总条数
    let count = 'SELECT count(*) FROM spu_info where 1=1 '
    if (spu) {
        sql = sql + `and i.spu='${spu}' `
        count = count + `and spu='${spu}' `
    }
    if (goods_classify) {
        sql = sql + `and i.goods_classify='${goods_classify}' `
        count = count + `and goods_classify='${goods_classify}' `
    }
    if (developer) {
        sql = sql + `and i.developer='${developer}' `
        count = count + `and developer='${developer}' `
    }
    if (spu_list) {
        const string = spu_list.join("','")
        sql = sql + `and i.spu in ('${string}') `
        count = count + `and spu in ('${string}') `
    }
    // 根据page参数进行查询
    const sortSql = ` order by update_time desc`
    if (pageNum === 1) {
        sql = sql + sortSql + ` limit ${pageSize}`;
    } else if (pageNum !== 1) {
        sql = sql + sortSql + ` limit ${startPage},${pageSize}`;
    }

    db.query(count, (err, results) => {
        if (err) return res.cc(err)
        let countNum = results[0]['count(*)'];
        db.query(sql, (err, results1) => {
            if (err) return res.cc(err)
            res.send({
                code: 200,
                message: '获取商品信息成功！',
                data: {
                    total: countNum,
                    list: results1
                }
            })

        })
    })
}

//获取变种详情
exports.searchSpuInfoDetail = (req, res) => {
    const { spu } = req.body
    const sql = `select i.*,j.*,n.*,g.classifyName,g.classifyType from sku_warehouse_info i join sku_goods_info j on i.sku_goods_id=j.sku_goods_id join sku_customs_info n on i.sku_goods_id=n.sku_goods_id join classify_info g on j.goods_classify=g.id where i.spu='${spu}'`
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        let imgList = []
        results.forEach(list => {
            //若截取不到id，则有可能只有一个图片id，直接赋值
            const imgId = findStrSubtringToStart(list.img_id, ',', 0) ? findStrSubtringToStart(list.img_id, ',', 0) : list.img_id
            if (imgId) {
                imgList.push(imgId)
            }
        })
        imgList = imgList.length === 0 ? '' : imgList.join("','")
        const sql1 = `select i.url,i.id from pictrue_info i where id in ('${imgList}')`
        db.query(sql1, (err, results1) => {
            if (err) return res.cc(err)
            results = results.map(img => {
                const imgId = img.img_id ? img.img_id.split(',')[0] : ''
                const index = results1.findIndex(n => n.id == imgId)
                img.img_url = (index !== -1) ? results1[index].url : ''
                return img
            })
            res.send({
                code: 200,
                message: '获取商品信息成功！',
                data: {
                    list: results
                }
            })
        })
    })
}

//多属性商品修改
exports.editSpuInfo = (req, res) => {
    const { warehouse_location, insert_time, old_sku_list, spu, goods_classify, goods_classify_name, goods_classify_type, sales_method, img_id, developer, purchaser, sku_list } = req.body
    const update_time = moment(new Date()).format('YYYY-MM-DD HH:mm:ss')
    let sku_customs_info = ''
    const sku_customs_info_array = []
    let sku_goods_info = ''
    const sku_goods_info_array = []
    let sku_warehouse_info = ''
    const sku_warehouse_info_array = []
    let sku_string = []
    sku_list.forEach(element => {
        sku_string.push(element.sku_goods_id)
        //拿到所有数据
        const array = "sku_goods_id, declare_en, declare_cn, declare_weight, declare_price, dangerous_goods, material_quality, purpose, customs_id, platform_sku, Identification_code, name_cn, name_en, status, weight, purchase_ref_price, length, wide, height, weighting_error, source_url, goods_remark, sales_method, warehouse_location, shelf_location, storage, safe_storagere, unit_price, total_price, purchase_in_transit, warehouse_in_transit, transferi_in_transit, pre_sale, available_inventory, warehouse_remark".split(', ')
        array.forEach(key => {
            element[key] = element[key] || ''
        })
        const {
            sku_goods_id, declare_en, declare_cn, declare_weight, declare_price, dangerous_goods, material_quality, purpose, customs_id,//sku_customs_info
            platform_sku, Identification_code, name_cn, name_en, status, weight, purchase_ref_price, length, wide, height, weighting_error, source_url, goods_remark, sales_method,//sku_goods_id,img_id,goods_classify,insert_time,update_time - sku_goods_info
            shelf_location, storage, safe_storagere, unit_price, total_price, purchase_in_transit, warehouse_in_transit, transferi_in_transit, pre_sale, available_inventory, warehouse_remark//spu,sku_goods_id - sku_warehouse_info
        } = element
        const img_id = element.imgId || ''
        sku_customs_info_array.push([
            sku_goods_id, declare_en, declare_cn, declare_weight, declare_price, dangerous_goods, material_quality, purpose, customs_id
        ])
        sku_goods_info_array.push([
            platform_sku, Identification_code, name_cn, name_en, status, weight, purchase_ref_price, purchaser, developer, length, wide, height, weighting_error, source_url, goods_remark, sales_method, sku_goods_id, img_id, goods_classify, insert_time, update_time
        ])
        sku_warehouse_info_array.push([
            warehouse_location, shelf_location, storage, safe_storagere, unit_price, total_price, purchase_in_transit, warehouse_in_transit, transferi_in_transit, pre_sale, available_inventory, warehouse_remark, spu, sku_goods_id
        ])
        sku_customs_info = `insert into sku_customs_info (sku_goods_id,declare_en,declare_cn,declare_weight,declare_price,dangerous_goods,material_quality,purpose,customs_id)values ?`
        sku_goods_info = `insert into sku_goods_info (platform_sku,Identification_code,name_cn,name_en,status,weight,purchase_ref_price,purchaser,developer,length,wide,height,weighting_error,source_url,goods_remark,sales_method,sku_goods_id,img_id,goods_classify,insert_time,update_time)values ?`
        sku_warehouse_info = `insert into sku_warehouse_info (warehouse_location,shelf_location,storage,safe_storagere,unit_price,total_price,purchase_in_transit,warehouse_in_transit,transferi_in_transit,pre_sale,available_inventory,warehouse_remark,spu,sku_goods_id)values ?`
    });

    const spu_info = {
        goods_classify, sales_method, img_id, developer, purchaser, sku_list: sku_string.join(','), sku_list_number: sku_list.length, insert_time, update_time, warehouse_location
    }

    const sku_list_string = old_sku_list.split(',').join("','")
    const deleteAllSql1 = `delete from sku_customs_info where sku_goods_id in ('${sku_list_string}')`
    const deleteAllSql2 = `delete from sku_goods_info where sku_goods_id in ('${sku_list_string}')`
    const deleteAllSql3 = `delete from sku_warehouse_info where sku_goods_id in ('${sku_list_string}')`

    //先删除所有的
    execTransection([
        {
            sql: deleteAllSql1,
            values: []
        },
        {
            sql: deleteAllSql2,
            values: []
        },
        {
            sql: deleteAllSql3,
            values: []
        },
        {
            sql: `update spu_info set ? where spu="${spu}"`,
            values: spu_info
        },
        {
            sql: sku_customs_info,
            values: [sku_customs_info_array]
        },
        {
            sql: sku_goods_info,
            values: [sku_goods_info_array]
        },
        {
            sql: sku_warehouse_info,
            values: [sku_warehouse_info_array]
        }
    ]).then(resp => {
        res.send({
            code: 200,
            message: '修改多属性商品成功！',
            data: {}
        })
    }).catch(err => {
        console.log(err)
        res.cc('修改多属性商品失败！')
    })
}

//删除spu商品信息
exports.deleteSpuInfo = (req, res) => {
    //查询spu现有的sku列表
    const sql = `select i.sku_list from spu_info i where spu='${req.body.spu}'`
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        if (results.length !== 1) return res.cc('该spu不存在')
        const sku_string = results[0].sku_list.split(',').join("','")
        const spu_sql = `delete from spu_info where spu='${req.body.spu}'`
        const sku_sql1 = `delete from sku_customs_info where sku_goods_id in ('${sku_string}')`
        const sku_sql2 = `delete from sku_goods_info where sku_goods_id in ('${sku_string}')`
        const sku_sql3 = `delete from sku_warehouse_info where sku_goods_id in ('${sku_string}')`
        //先删除所有的
        execTransection([
            {
                sql: spu_sql,
                values: []
            },
            {
                sql: sku_sql1,
                values: []
            },
            {
                sql: sku_sql1,
                values: []
            },
            {
                sql: sku_sql3,
                values: []
            }
        ]).then(resp => {
            res.send({
                code: 200,
                message: '删除多属性商品成功！',
                data: {}
            })
        }).catch(err => {
            console.log(err)
            res.cc('删除多属性商品失败！')
        })
    })
}