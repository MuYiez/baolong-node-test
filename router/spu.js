const express = require('express')
const router = express.Router()

// 导入用户路由处理函数模块
const table = require('../router_handler/spu')

//多属性商品新增
router.post('/spu/addSpuInfo', table.addSpuInfo)
//获取多属性商品信息，用于修改使用
router.post('/spu/getSpuInfo', table.getSpuInfo)
//查询多属性商品列表
router.post('/spu/searchSpuInfo', table.searchSpuInfo)
//获取变种详情
router.post('/spu/searchSpuInfoDetail', table.searchSpuInfoDetail)
//多属性商品修改
router.post('/spu/editSpuInfo', table.editSpuInfo)
//多属性商品删除
router.post('/spu/deleteSpuInfo', table.deleteSpuInfo)

module.exports = router