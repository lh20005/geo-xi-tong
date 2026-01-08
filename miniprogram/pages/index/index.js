// index.js
Page({
  onLoad(options) {
    // 检查是否从扫码进入（scene 参数包含绑定码）
    if (options.scene) {
      const bindCode = decodeURIComponent(options.scene)
      console.log('扫码进入首页，绑定码:', bindCode)
      
      // 验证绑定码格式（6位数字）
      if (/^\d{6}$/.test(bindCode)) {
        // 跳转到绑定页面，并传递绑定码
        wx.navigateTo({
          url: `/pages/bindAgent/bindAgent?scene=${bindCode}`
        })
      }
    }
  },

  goToBind() {
    wx.navigateTo({
      url: '/pages/bindAgent/bindAgent'
    })
  }
})
