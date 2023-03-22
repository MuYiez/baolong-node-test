const express = require('express')
const router = express.Router()

// 导入用户路由处理函数模块
const table = require('../router_handler/sku_goods')

//查询分类信息
router.get('/skuGoods/classifyInfoSearch', table.classifyInfoSearch)
//新增分类信息
router.post('/skuGoods/classifyInfoAdd', table.classifyInfoAdd)
//修改分类信息
router.post('/skuGoods/classifyInfoUpdate', table.classifyInfoUpdate)
//删除分类信息
router.post('/skuGoods/classifyInfoDelete', table.classifyInfoDelete)

//查询商品信息
router.post('/skuGoods/goodsInfoSearch', table.goodsInfoSearch)
//上传商品图片
router.post('/skuGoods/addPictrue', table.addPictrue)
//上传商品网络图片
router.post('/skuGoods/addNetPictrue', table.addNetPictrue)
//删除商品图片
router.post('/skuGoods/delPictrue', table.delPictrue)
//新增单属性商品信息
router.post('/skuGoods/goodsInfoAdd', table.goodsInfoAdd)
//修改商品信息
router.post('/skuGoods/goodsInfoChange', table.goodsInfoChange)
//删除商品信息
router.post('/skuGoods/goodsInfoDelete', table.goodsInfoDelete)
//获取sku商品信息编码
router.get('/skuGoods/getGoodsInfoCode', table.getGoodsInfoCode)
//获取商品spu编码
router.get('/skuGoods/getSpuCode', table.getSpuCode)
//修改商品状态
router.post('/skuGoods/changeGoodsStatus', table.changeGoodsStatus)
//获取商品详情
router.post('/skuGoods/getGoodsInfo', table.getGoodsInfo)
//编辑仓库信息
router.post('/skuGoods/editWarehouse', table.editWarehouse)

module.exports = router