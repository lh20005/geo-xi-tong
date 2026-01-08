// bindAgent.js
const app = getApp()

Page({
  data: {
    bindCode: '',
    loading: false,
    resultType: '', // 'success' | 'error' | ''
    resultMessage: ''
  },

  onCodeInput(e) {
    this.setData({
      bindCode: e.detail.value,
      resultType: '',
      resultMessage: ''
    })
  },

  async submitBind() {
    const { bindCode } = this.data
    
    if (bindCode.length !== 6) {
      this.showResult('error', '请输入6位绑定码')
      return
    }

    this.setData({ loading: true })

    try {
      // 1. 调用 wx.login 获取 code
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        })
      })

      if (!loginRes.code) {
        throw new Error('获取微信授权失败')
      }

      // 2. 调用后端接口提交绑定
      const result = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.apiBaseUrl}/agent/bindWechat/submit`,
          method: 'POST',
          data: {
            bindCode: bindCode,
            code: loginRes.code
          },
          header: {
            'Content-Type': 'application/json'
          },
          success: (res) => {
            if (res.statusCode === 200 && res.data.success) {
              resolve(res.data)
            } else {
              reject(new Error(res.data.message || '绑定失败'))
            }
          },
          fail: (err) => {
            reject(new Error('网络请求失败'))
          }
        })
      })

      // 绑定成功
      this.showResult('success', '绑定成功！佣金将自动结算到您的微信零钱')
      
      // 3秒后返回上一页
      setTimeout(() => {
        wx.navigateBack()
      }, 3000)

    } catch (error) {
      console.error('绑定失败:', error)
      this.showResult('error', error.message || '绑定失败，请重试')
    } finally {
      this.setData({ loading: false })
    }
  },

  showResult(type, message) {
    this.setData({
      resultType: type,
      resultMessage: message
    })
  }
})
