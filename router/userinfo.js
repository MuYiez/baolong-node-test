const express = require('express')
const router = express.Router()

// 导入验证数据合法性的中间件
const expressJoi = require('@escook/express-joi')

// 导入需要的验证规则对象
const { update_password_schema } = require('../schema/user')

// 导入用户信息的处理函数模块
const userinfo_handler = require('../router_handler/userinfo')

// 获取用户的基本信息
router.get('/userinfo', userinfo_handler.getUserInfo)

// 获取用户的路由信息
router.get('/getMenuList', userinfo_handler.getMenuList)

// 获取用户的按钮权限
router.get('/getPermCode', userinfo_handler.getPermCode)

// 重置密码的路由
router.post('/updatepwd', expressJoi(update_password_schema), userinfo_handler.updatePassword)

//获取所有用户的基本信息
router.get('/allUser', userinfo_handler.getAllUser)

//获取所有路由信息
router.get('/getMenu', userinfo_handler.getMenu)

module.exports = router