const express = require('express')
const router = express.Router()

// 导入用户路由处理函数模块
const table = require('../router_handler/gross_profit_table')

// 1. 导入验证表单数据的中间件
const expressJoi = require('@escook/express-joi')
// 2. 导入需要的验证规则对象
// const { reg_login_schema } = require('../schema/user')

// 查询月度参数表
router.post('/parameter/search', table.parameterSearch)
//修改月度参数表
router.post('/parameter/change', table.parameterChange)

//查询sku商品
router.post('/skuGoods/autosearch', table.skuGoodsAutosearch)
//新增每日毛利表
router.post('/skuGoods/addDailyTable', table.addDailyTable)
//查询每日毛利表
router.post('/skuGoods/searchDailyTable', table.searchDailyTable)
//查询每日毛利表详情
router.post('/skuGoods/getTableDetail', table.getTableDetail)
//修改每日毛利表
router.post('/skuGoods/editDailyTable', table.editDailyTable)
//查询是否商品危险品属性
router.post('/skuGoods/searchDangerousGoods', table.searchDangerousGoods)
//修改毛利表栏位排序
router.post('/skuGoods/editGrossColumns', table.editGrossColumns)
//获取毛利表栏位排序
router.get('/skuGoods/getGrossColumns', table.getGrossColumns)

module.exports = router