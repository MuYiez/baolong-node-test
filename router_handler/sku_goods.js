// 导入数据库操作模块
const db = require('../db/index')
const execTransection = require('../commom/execTransection')
const moment = require('moment')
const upload = require('../commom/upload.js');
const createSpuId = require('../commom/createSpuId.js');
const checkIdOccupy = require("../commom/checkIdOccupy")
const batchUpdate = require('../commom/batchUpdate')
var mysql = require('mysql')

const findParent = (data, list, parentId) => {
    data = data.map(res => {
        if (res.key === parentId) {
            res.children.push(list)
        } else if (res.children.length !== 0) {
            res.children = findParent(res.children, list, parentId)
        }
        return res
    })
    return data
}

// 分类信息查询
exports.classifyInfoSearch = (req, res) => {
    const sql = `select * from classify_info order by level`

    // 执行 SQL 语句查询用户是否存在
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        let data = []
        results.forEach(item => {
            let list = {
                key: item.id,
                value: item.id + '----' + item.classifyName + ' - ' + item.classifyType,
                title: item.classifyName + ' - ' + item.classifyType,
                type: item.classifyType,
                level: item.level,
                children: []
            }
            switch (item.level) {
                case 0:
                    data.push(list)
                    break;
                default:
                    data = findParent(data, list, item.parentId)
                    break;
            }
        })
        res.send({
            code: 200,
            message: '获取分类信息成功！',
            data
        })
    })
}

// 分类信息新增
exports.classifyInfoAdd = (req, res) => {
    const { classifyName, classifyType, level, parentId } = req.body
    const sql = `insert into classify_info (classifyName,classifyType,level,parentId)values('${classifyName}','${classifyType}',${level},${parentId})`
    // 更新参数表
    db.query(sql, req.body, (err, results) => {
        if (err) return res.cc(err)
        if (results.affectedRows !== 1) return res.cc('新增参数信息失败！')
        res.send({
            code: 200,
            message: '新增参数信息成功！',
            data: {
                ...results[0]
            }
        })
    })
}

// 分类信息修改
exports.classifyInfoUpdate = (req, res) => {
    const sql = `update classify_info set classifyName='${req.body.classifyName}',classifyType='${req.body.classifyType}' where id=${req.body.id}`
    // 更新参数表
    db.query(sql, req.body, (err, results) => {
        if (err) return res.cc(err)
        if (results.affectedRows !== 1) return res.cc('修改参数信息失败！')
        res.send({
            code: 200,
            message: '修改参数信息成功！',
            data: {
                ...results[0]
            }
        })
    })
}

// 分类信息删除
exports.classifyInfoDelete = (req, res) => {
    const sql = `delete from classify_info where id=${req.body.id} or parentId=${req.body.id}`
    // 删除参数表
    db.query(sql, req.body, (err, results) => {
        if (err) return res.cc(err)
        if (results.affectedRows === 0) return res.cc('删除参数信息失败！')
        res.send({
            code: 200,
            message: '删除参数信息成功！',
            data: {
                ...results[0]
            }
        })
    })
}

/**
 * sku商品信息
 */

// 商品信息查询
exports.goodsInfoSearch = (req, res) => {
    // select count(*) from (select distinct t.calculate_date from gross_margin_table t)as a;
    const { sku_list, spu_list, name_cn, spu, sku_goods_id, goods_classify, developer } = req.body
    let pageNum = (req.body.pageNum == undefined) ? 1 : Number(req.body.pageNum);
    let pageSize = (req.body.pageSize == undefined) ? 10 : Number(req.body.pageSize);
    let startPage = (pageNum - 1) * pageSize;
    let sql = `SELECT i.*, g.*, j.*, n.classifyName,n.classifyType FROM sku_goods_info i JOIN sku_customs_info g ON i.sku_goods_id = g.sku_goods_id JOIN sku_warehouse_info j ON i.sku_goods_id = j.sku_goods_id left JOIN classify_info n ON i.goods_classify = n.id where 1=1 `
    //查询总条数
    let count = 'SELECT count(*) FROM sku_goods_info i JOIN sku_customs_info g ON i.sku_goods_id = g.sku_goods_id JOIN sku_warehouse_info j ON i.sku_goods_id = j.sku_goods_id left JOIN classify_info n ON i.goods_classify = n.id where 1=1 '
    if (name_cn) {
        sql = sql + `and i.name_cn like '%${name_cn}%' `
        count = count + `and i.name_cn like '%${name_cn}%' `
    }
    if (spu) {
        sql = sql + `and j.spu='${spu}' `
        count = count + `and j.spu='${spu}' `
    }
    if (sku_goods_id) {
        sql = sql + `and i.sku_goods_id='${sku_goods_id}' `
        count = count + `and i.sku_goods_id='${sku_goods_id}' `
    }
    if (goods_classify) {
        sql = sql + `and i.goods_classify='${goods_classify}' `
        count = count + `and i.goods_classify='${goods_classify}' `
    }
    if (developer) {
        sql = sql + `and i.developer='${developer}' `
        count = count + `and i.developer='${developer}' `
    }
    if (sku_list) {
        const string = sku_list.join("','")
        sql = sql + `and i.sku_goods_id in ('${string}') `
        count = count + `and i.sku_goods_id in ('${string}') `
    }
    if (spu_list) {
        const string = spu_list.join("','")
        sql = sql + `and j.spu in ('${string}') `
        count = count + `and j.spu in ('${string}') `
    }
    const sortSql = `order by update_time desc`
    // 根据page参数进行查询
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
            let img_id_list = []
            results1.forEach(list => {
                if (list.img_id) {
                    img_id_list.push(list.img_id)
                }
            })
            const img_id_string = img_id_list.join(',')
            if (img_id_string) {
                //获取对应的图片列表
                const sql2 = `select * from pictrue_info where id in (${img_id_string})`
                db.query(sql2, (err, results2) => {
                    if (err) return res.cc(err)
                    results1 = results1.map(img => {
                        const imgId = img.img_id ? img.img_id.split(',')[0] : ''
                        const index = results2.findIndex(n => n.id == imgId)
                        img.img_url = (index !== -1) ? results2[index].url : ''
                        return img
                    })
                    res.send({
                        code: 200,
                        message: '获取商品信息成功！',
                        data: {
                            total: countNum,
                            list: results1
                        }
                    })
                })
            } else {
                res.send({
                    code: 200,
                    message: '获取商品信息成功！',
                    data: {
                        total: countNum,
                        list: results1
                    }
                })
            }

        })
    })
}

//上传商品图片
exports.addPictrue = (req, res) => {
    upload(req, res).then(imgsrc => {
        const { sku_goods_id, spu } = req.body
        const skuGoodsId = sku_goods_id ? sku_goods_id : ''
        const spuId = spu ? spu : ''
        const sql = `insert into pictrue_info (url,name,sku_goods_id,spu)values('${imgsrc}','${req.file.originalname}','${skuGoodsId}','${spuId}')`
        // 更新图片表
        db.query(sql, req.body, (err, results) => {
            if (err) return res.cc(err)
            if (results.affectedRows !== 1) return res.cc('新增图片失败！')
            res.send({
                code: 200,
                message: '新增图片成功！',
                data: {
                    id: results.insertId,
                    url: imgsrc
                }
            })
        })
    })
}

//上传商品网络图片
exports.addNetPictrue = (req, res) => {
    const { sku_goods_id, spu, list } = req.body
    let sql = ''
    const skuGoodsId = sku_goods_id ? sku_goods_id : ''
    const spuId = spu ? spu : ''
    list.forEach((element, index) => {
        let model_sql = `insert into pictrue_info (url,name,sku_goods_id,spu)values('${element}',"${Date.now() + 'order' + index + '.png'}",'${skuGoodsId}','${spuId}')`;
        sql += mysql.format(model_sql, element) + ';'
    });
    // 更新图片表
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        //若只有一条数据
        if (!results.length) {
            results = [results]
        }
        res.send({
            code: 200,
            message: '新增图片成功！',
            data: {
                list: results.map(list => {
                    return list.insertId
                })
            }
        })
    })
}

//删除商品图片
exports.delPictrue = (req, res) => {
    const { id, sku_goods_id, spu } = req.body
    const sql = `delete from pictrue_info where id='${id}'`
    db.query(sql, req.body, (err, results) => {
        if (err) return res.cc(err)
        if (results.affectedRows === 0) return res.cc('删除图片失败！')
        res.send({
            code: 200,
            message: '删除图片成功！',
            data: {
                ...results[0]
            }
        })
    })
}

// 商品信息新增
exports.goodsInfoAdd = (req, res) => {
    let spu = req.body.spu
    let sku_goods_id = req.body.sku_goods_id
    const old_spu = spu
    checkIdOccupy(spu).then((obj) => {
        if (obj.isOccupy) {
            //该id被占用，重新替换新id
            const classifyType = spu.substring(0, 2)
            const department = spu[spu.length - 3]
            spu = classifyType + moment(new Date()).format('YYYYMMDD') + department + obj.id
            sku_goods_id = sku_goods_id.replace(new RegExp(old_spu, "gm"), spu)
        }

        const { declare_en, declare_cn, declare_weight, declare_price, dangerous_goods, material_quality, purpose, customs_id } = req.body
        const sku_customs_info = {
            sku_goods_id, declare_en, declare_cn, declare_weight, declare_price, dangerous_goods, material_quality, purpose, customs_id
        }

        const { platform_sku, Identification_code, name_cn, name_en, status, weight, purchase_ref_price, purchaser, developer, length, wide, height, weighting_error, source_url, goods_remark, sales_method, goods_classify, img_id } = req.body
        const insert_time = moment(new Date()).format('YYYY-MM-DD HH:mm:ss'), update_time = moment(new Date()).format('YYYY-MM-DD HH:mm:ss')
        const sku_goods_info = {
            sku_goods_id, platform_sku, Identification_code, name_cn, name_en, status, weight, purchase_ref_price, purchaser, developer, length, wide, height, weighting_error, source_url, goods_remark, insert_time, update_time, sales_method, goods_classify, img_id
        }

        const { warehouse_location, shelf_location, storage, safe_storagere, unit_price, total_price, purchase_in_transit, warehouse_in_transit, transferi_in_transit, pre_sale, available_inventory, warehouse_remark } = req.body
        const sku_warehouse_info = {
            sku_goods_id, spu, warehouse_location, shelf_location, storage, safe_storagere, unit_price, total_price, purchase_in_transit, warehouse_in_transit, transferi_in_transit, pre_sale, available_inventory, warehouse_remark
        }

        const spu_info = {
            spu, goods_classify, sales_method, developer, purchaser, sku_list: sku_goods_id, sku_list_number: 1, img_id: img_id.split(',')[0], insert_time, update_time
        }
        execTransection([
            {
                sql: "insert into spu_info set ?",
                values: spu_info
            },
            {
                sql: "insert into sku_customs_info set ?",
                values: sku_customs_info
            },
            {
                sql: "insert into sku_goods_info set ?",
                values: sku_goods_info
            }, {
                sql: "insert into sku_warehouse_info set ?",
                values: sku_warehouse_info
            },
            {
                sql: `update daily_id_list set is_occupy=1 where index_spu_id='${obj.id}'`,
                values: []
            }
        ]).then(resp => {
            res.send({
                code: 200,
                message: '新增商品信息成功！',
                data: {}
            })
        }).catch(err => {
            console.log(err)
            res.cc('新增商品信息失败！')
        })
    })
}

// 商品信息修改
exports.goodsInfoChange = (req, res) => {
    //更新sku_customs_info表内的数据
    const { sku_goods_id, declare_en, declare_cn, declare_weight, declare_price, dangerous_goods, material_quality, purpose, customs_id } = req.body
    const sku_customs_info = {
        sku_goods_id, declare_en, declare_cn, declare_weight, declare_price, dangerous_goods, material_quality, purpose, customs_id
    }
    let sql1 = `update sku_customs_info set ? where sku_goods_id='${sku_goods_id}'`

    //更新sku_goods_info表内的数据
    const { platform_sku, Identification_code, name_cn, name_en, status, weight, purchase_ref_price, purchaser, developer, length, wide, height, weighting_error, source_url, goods_remark, sales_method, goods_classify, img_id } = req.body
    const update_time = moment(new Date()).format('YYYY-MM-DD HH:mm:ss')
    const sku_goods_info = {
        sku_goods_id, platform_sku, Identification_code, name_cn, name_en, status, weight, purchase_ref_price, purchaser, developer, length, wide, height, weighting_error, source_url, goods_remark, update_time, sales_method, goods_classify, img_id
    }
    let sql2 = `update sku_goods_info set ? where sku_goods_id='${sku_goods_id}'`

    //更新sku_warehouse_info表内的数据
    const { spu, warehouse_location, shelf_location, storage, safe_storagere, unit_price, total_price, purchase_in_transit, warehouse_in_transit, transferi_in_transit, pre_sale, available_inventory, warehouse_remark } = req.body
    const sku_warehouse_info = {
        sku_goods_id, spu, warehouse_location, shelf_location, storage, safe_storagere, unit_price, total_price, purchase_in_transit, warehouse_in_transit, transferi_in_transit, pre_sale, available_inventory, warehouse_remark
    }
    let sql3 = `update sku_warehouse_info set ? where sku_goods_id='${sku_goods_id}'`

    //更新spu_info表内的数据
    const spu_info = {
        spu, goods_classify, sales_method, developer, purchaser, sku_list: sku_goods_id, sku_list_number: 1, img_id: img_id.split(',')[0]
    }
    execTransection([
        {
            sql: `update spu_info set ? where spu='${spu}'`,
            values: spu_info
        },
        {
            sql: sql1,
            values: sku_customs_info
        }, {
            sql: sql2,
            values: sku_goods_info
        }, {
            sql: sql3,
            values: sku_warehouse_info
        }]).then(resp => {
            res.send({
                code: 200,
                message: '修改商品信息成功！',
                data: {}
            })
        }).catch(err => {
            console.log(err)
            res.cc('修改商品信息失败！')
        })
}

// 获取商品信息编码
exports.getGoodsInfoCode = (req, res) => {
    const sql = `SELECT seq('seq_index_goods_id') as sku_goods_id`
    db.query(sql, req.body, (err, results) => {
        if (err) return res.cc(err)
        if (!results[0].sku_goods_id) return res.cc('获取商品编码失败！')
        res.send({
            code: 200,
            message: '获取商品编码成功！',
            data: {
                ...results[0]
            }
        })
    })
}

function PrefixInteger(num, length) {
    return (Array(length).join('0') + num).slice(-length);
}

// 获取商品spu编码
exports.getSpuCode = (req, res) => {
    let { classifyType, department } = req.query
    department = department ? department : ''
    createSpuId(classifyType, department).then(id => {
        res.send({
            code: 200,
            message: '获取商品spu编码成功！',
            //生成规则（商品类别（QW）+当前日期（20230104）+部门代号（A）+当天序号（01））
            data: {
                spu: id
            }
        })
    })
}

//删除商品信息
exports.goodsInfoDelete = (req, res) => {
    const { sku_goods_id, spu } = req.body
    const sql1 = `delete from sku_customs_info where sku_goods_id='${sku_goods_id}'`
    const sql2 = `delete from sku_goods_info where sku_goods_id='${sku_goods_id}'`
    const sql3 = `delete from sku_warehouse_info where sku_goods_id='${sku_goods_id}'`

    //获取spu_info信息
    const sql5 = `select * from spu_info where spu='${spu}'`
    db.query(sql5, req.body, (err, results) => {
        if (err) return res.cc(err)

        let sql4 = ``
        if (sku_goods_id == results[0].sku_list) {
            //spu表中只有当前一个sku，做删除处理
            sql4 = `delete from spu_info where spu='${spu}'`
        } else {
            //删除spu_info表内相对应的sku信息
            let sku_list = []
            results[0].sku_list.split(',').forEach(data => {
                if (sku_goods_id !== data) {
                    sku_list.push(data)
                }
            })
            sku_list = sku_list.join(',')
            const sku_list_number = results[0].sku_list_number - 1
            sql4 = `update spu_info set sku_list='${sku_list}',sku_list_number=${sku_list_number} where spu='${spu}'`
        }

        execTransection([{
            sql: sql1,
            values: []
        }, {
            sql: sql2,
            values: []
        },
        {
            sql: sql3,
            values: []
        },
        {
            sql: sql4,
            values: []
        }]).then(resp => {
            res.send({
                code: 200,
                message: '删除商品信息成功！',
                data: {}
            })
        }).catch(err => {
            console.log(err)
            res.cc('删除商品信息失败！')
        })
    })

}

//修改商品状态
exports.changeGoodsStatus = (req, res) => {
    const { status, sku_goods_id } = req.body
    const sql = `update sku_goods_info set status='${status}' where sku_goods_id='${sku_goods_id}'`
    db.query(sql, req.body, (err, results) => {
        if (err) return res.cc(err)
        if (results.affectedRows !== 1) return res.cc('修改商品状态失败！')
        res.send({
            code: 200,
            message: '修改商品状态成功！',
            data: {
                ...results[0]
            }
        })
    })
}

//获取商品详情
exports.getGoodsInfo = (req, res) => {
    const { sku_goods_id } = req.body
    const sql1 = `SELECT i.*, g.*, j.*, n.classifyName,n.classifyType FROM sku_goods_info i JOIN sku_customs_info g ON i.sku_goods_id = g.sku_goods_id JOIN sku_warehouse_info j ON i.sku_goods_id = j.sku_goods_id left JOIN classify_info n ON i.goods_classify = n.id where i.sku_goods_id='${sku_goods_id}'`
    db.query(sql1, req.body, (err, results) => {
        if (err) return res.cc(err)
        img_id = results[0].img_id ? results[0].img_id : null
        const sql2 = `select * from pictrue_info where id in (${img_id})`
        db.query(sql2, req.body, (err, results1) => {
            if (err) return res.cc(err)
            res.send({
                code: 200,
                message: '获取商品信息成功！',
                data: {
                    ...results[0],
                    picture_list: results1
                }
            })
        })
    })
}

//编辑仓库信息
exports.editWarehouse = (req, res) => {
    const list = req.body.list
    const sql = batchUpdate('sku_goods_info', 'sku_goods_id', list, ['length', 'wide', 'height', 'weight'])
    db.query(sql, (err, results) => {
        if (err) return res.cc(err)
        res.send({
            code: 200,
            message: '修改仓库信息成功！'
        })
    })
}