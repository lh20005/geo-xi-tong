// bindAgent.js
const app = getApp()

Page({
  data: {
    bindCode: '',
    loading: false,
    resultType: '', // 'success' | 'error' | ''
    resultMessage: '',
    isFromScan: false  // 是否从扫码进入
  },

  onLoad(options) {
    // 检查是否从扫码进入（scene 参数包含绑定码）
    // 可能直接从扫码进入，也可能从首页跳转过来
    const scene = options.scene
    if (scene) {
      const bindCode = decodeURIComponent(scene)
      console.log('扫码进入绑定页，绑定码:', bindCode)
      
      // 验证绑定码格式（6位数字）
      if (/^\d{6}$/.test(bindCode)) {
        this.setData({ 
          bindCode: bindCode,
          isFromScan: true
        })
        // 自动触发绑定
        this.submitBind()
      }
    }
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
            reject(new Error('网络请求失败，请检查网络连接'))
          }
        })
      })

      // 绑定成功
      this.showResult('success', '佣金将自动结算到您的微信零钱')
      
      // 3秒后关闭小程序或返回
      setTimeout(() => {
        if (this.data.isFromScan) {
          // 扫码进入的，直接关闭小程序
          wx.exitMiniProgram({
            fail: () => {
              // 如果无法退出，返回首页
              wx.reLaunch({ url: '/pages/index/index' })
            }
          })
        } else {
          wx.navigateBack({
            fail: () => {
              wx.reLaunch({ url: '/pages/index/index' })
            }
          })
        }
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
