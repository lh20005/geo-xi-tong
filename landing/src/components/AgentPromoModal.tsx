/**
 * 代理商加盟推广弹窗
 * 在首页访问时弹出，引导用户成为代理商
 * 针对移动端优化显示效果
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface AgentPromoModalProps {
  isLoggedIn: boolean;
  onEnterSystem: () => void;
}

export default function AgentPromoModal({ isLoggedIn, onEnterSystem }: AgentPromoModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // 每次进入页面都显示弹窗，延迟2秒让用户先看到页面
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  // 自动轮播步骤
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % 4);
    }, 2500);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleAction = () => {
    setIsOpen(false);
    if (isLoggedIn) {
      onEnterSystem();
    }
  };

  // 加入步骤
  const steps = [
    { icon: '📝', title: '免费注册' },
    { icon: '👤', title: '个人中心' },
    { icon: '🎯', title: '开通代理' },
    { icon: '📱', title: '绑定微信' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* 弹窗内容 */}
      <div className="relative w-full max-w-lg sm:max-w-2xl max-h-[80vh] sm:max-h-[85vh] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-xl sm:rounded-2xl shadow-2xl border border-purple-500/30 animate-scaleIn overflow-hidden">
        {/* 关闭按钮 - 手机端更大更明显 */}
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-all z-10"
        >
          <svg className="w-5 h-5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 顶部装饰条 */}
        <div className="absolute top-0 left-0 right-0 h-1 sm:h-1.5 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-t-xl sm:rounded-t-2xl" />
        
        {/* 可滚动内容区域 */}
        <div className="max-h-[80vh] sm:max-h-[85vh] overflow-y-auto pb-safe">
          {/* 热门标签 */}
          <div className="flex justify-center pt-3 sm:pt-5">
            <div className="px-3 sm:px-5 py-1 sm:py-1.5 bg-gradient-to-r from-red-500 to-orange-500 rounded-full text-white text-[10px] sm:text-xs font-bold shadow-lg animate-bounce">
              🔥 限时免费加盟 · 永久分佣
            </div>
          </div>

          <div className="p-3 sm:p-6 md:p-8 pt-2">
            {/* 标题区域 - 移动端更紧凑 */}
            <div className="text-center mb-3 sm:mb-6">
              <img src="/images/logo.png" alt="GEO Logo" className="w-14 h-14 sm:w-20 sm:h-20 mx-auto mb-2 sm:mb-4 rounded-xl sm:rounded-2xl shadow-lg" />
              <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2">
                <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                  0元加盟
                </span>
                <span className="text-white"> GEO SaaS系统代理商</span>
              </h2>
              <p className="text-purple-200 text-xs sm:text-sm md:text-base">
                AI搜索时代的创业新机遇 · 永久30%分佣 · T+1到账
              </p>
            </div>

            {/* 核心卖点横幅 */}
            <div className="bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-red-500/20 rounded-lg sm:rounded-xl p-2.5 sm:p-4 mb-3 sm:mb-6 border border-yellow-500/30">
              <div className="grid grid-cols-4 gap-1 sm:gap-4 text-center">
                <div>
                  <div className="text-lg sm:text-2xl md:text-3xl font-bold text-yellow-400">¥0</div>
                  <div className="text-[9px] sm:text-xs text-purple-200">加盟费用</div>
                </div>
                <div>
                  <div className="text-lg sm:text-2xl md:text-3xl font-bold text-green-400">30%</div>
                  <div className="text-[9px] sm:text-xs text-purple-200">永久分佣</div>
                </div>
                <div>
                  <div className="text-lg sm:text-2xl md:text-3xl font-bold text-orange-400">T+1</div>
                  <div className="text-[9px] sm:text-xs text-purple-200">快速到账</div>
                </div>
                <div>
                  <div className="text-lg sm:text-2xl md:text-3xl font-bold text-blue-400">∞</div>
                  <div className="text-[9px] sm:text-xs text-purple-200">客户终身绑定</div>
                </div>
              </div>
            </div>

            {/* 痛点对比卡片 - 移动端纵向排列 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-6">
              {/* 别人家的代理 */}
              <div className="relative bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-lg sm:rounded-xl p-2.5 sm:p-4 border border-red-500/30 overflow-hidden">
                <div className="flex items-center mb-2 sm:mb-3">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold mr-2">
                    ✕
                  </div>
                  <h3 className="text-white font-bold text-sm sm:text-base">别人家的代理</h3>
                </div>
                <ul className="space-y-1 sm:space-y-2 text-red-200 text-xs sm:text-sm">
                  <li className="flex items-center">
                    <span className="mr-1.5 sm:mr-2">💸</span>
                    <span>加盟费<span className="text-red-400 font-bold">数万元</span>起</span>
                  </li>
                  <li className="flex items-center">
                    <span className="mr-1.5 sm:mr-2">📊</span>
                    <span>需完成销售任务</span>
                  </li>
                  <li className="flex items-center">
                    <span className="mr-1.5 sm:mr-2">⏰</span>
                    <span>代理期限有限制</span>
                  </li>
                </ul>
              </div>

              {/* 我们的代理 */}
              <div className="relative bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg sm:rounded-xl p-2.5 sm:p-4 border border-green-500/30 overflow-hidden">
                <div className="flex items-center mb-2 sm:mb-3">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold mr-2">
                    ✓
                  </div>
                  <h3 className="text-white font-bold text-sm sm:text-base">我们的代理</h3>
                </div>
                <ul className="space-y-1 sm:space-y-2 text-green-200 text-xs sm:text-sm">
                  <li className="flex items-center">
                    <span className="mr-1.5 sm:mr-2">🆓</span>
                    <span>完全免费<span className="text-green-400 font-bold">0门槛</span></span>
                  </li>
                  <li className="flex items-center">
                    <span className="mr-1.5 sm:mr-2">💰</span>
                    <span>30%分佣<span className="text-green-400 font-bold">T+1到账</span></span>
                  </li>
                  <li className="flex items-center">
                    <span className="mr-1.5 sm:mr-2">♾️</span>
                    <span>客户<span className="text-green-400 font-bold">终身绑定</span>你</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* 适合人群 - 移动端2x2网格更紧凑 */}
            <div className="bg-white/5 rounded-lg sm:rounded-xl p-2.5 sm:p-4 mb-3 sm:mb-6 border border-white/10">
              <h3 className="text-yellow-400 font-bold mb-2 sm:mb-3 flex items-center justify-center text-sm sm:text-base">
                <span className="mr-1.5 sm:mr-2">🎯</span>
                这些痛点你有吗？
              </h3>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
                <div className="flex items-center space-x-1.5 sm:space-x-2 bg-white/5 rounded-lg p-1.5 sm:p-2.5">
                  <span className="text-base sm:text-lg flex-shrink-0">🤔</span>
                  <div>
                    <p className="text-white text-xs sm:text-sm font-medium">想入局GEO</p>
                    <p className="text-purple-300 text-[10px] sm:text-xs hidden sm:block">但不知从何下手</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 sm:space-x-2 bg-white/5 rounded-lg p-1.5 sm:p-2.5">
                  <span className="text-base sm:text-lg flex-shrink-0">💼</span>
                  <div>
                    <p className="text-white text-xs sm:text-sm font-medium">想做代运营</p>
                    <p className="text-purple-300 text-[10px] sm:text-xs hidden sm:block">但没有专业系统</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 sm:space-x-2 bg-white/5 rounded-lg p-1.5 sm:p-2.5">
                  <span className="text-base sm:text-lg flex-shrink-0">🏢</span>
                  <div>
                    <p className="text-white text-xs sm:text-sm font-medium">想代理产品</p>
                    <p className="text-purple-300 text-[10px] sm:text-xs hidden sm:block">但加盟费太贵</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 sm:space-x-2 bg-white/5 rounded-lg p-1.5 sm:p-2.5">
                  <span className="text-base sm:text-lg flex-shrink-0">📈</span>
                  <div>
                    <p className="text-white text-xs sm:text-sm font-medium">想增加副业</p>
                    <p className="text-purple-300 text-[10px] sm:text-xs hidden sm:block">但没有好项目</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 解决方案亮点 */}
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg sm:rounded-xl p-2.5 sm:p-4 mb-3 sm:mb-6 border border-purple-500/30">
              <h3 className="text-center text-white font-bold mb-2 sm:mb-3 text-sm sm:text-base">
                <span className="text-yellow-400">✨</span> 成为代理商获得
              </h3>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
                <div className="bg-white/5 rounded-lg p-2 sm:p-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-1 sm:mb-2 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center">
                    <span className="text-lg sm:text-xl">🛠️</span>
                  </div>
                  <p className="text-white text-[10px] sm:text-xs font-medium">专业系统</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2 sm:p-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-1 sm:mb-2 bg-gradient-to-br from-green-400 to-green-600 rounded-lg sm:rounded-xl flex items-center justify-center">
                    <span className="text-lg sm:text-xl">💵</span>
                  </div>
                  <p className="text-white text-[10px] sm:text-xs font-medium">T+1到账</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2 sm:p-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-1 sm:mb-2 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg sm:rounded-xl flex items-center justify-center">
                    <span className="text-lg sm:text-xl">🎁</span>
                  </div>
                  <p className="text-white text-[10px] sm:text-xs font-medium">专属邀请码</p>
                </div>
              </div>
            </div>

            {/* 加入步骤 - 移动端更紧凑 */}
            <div className="mb-3 sm:mb-6">
              <h3 className="text-center text-white font-bold mb-2 sm:mb-4 text-sm sm:text-base">
                <span className="text-green-400">📋</span> 4步轻松加入
              </h3>
              <div className="flex justify-between items-center">
                {steps.map((step, index) => (
                  <div 
                    key={index}
                    className="flex flex-col items-center flex-1"
                  >
                    <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-lg sm:text-2xl mb-1 sm:mb-2 transition-all duration-300 ${
                      currentStep === index 
                        ? 'bg-gradient-to-r from-yellow-400 to-orange-400 scale-105 sm:scale-110 shadow-lg shadow-yellow-500/30' 
                        : 'bg-white/10'
                    }`}>
                      {step.icon}
                    </div>
                    <p className={`text-[10px] sm:text-xs font-medium text-center transition-colors ${
                      currentStep === index ? 'text-yellow-400' : 'text-white'
                    }`}>
                      {step.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA按钮 */}
            <div className="flex flex-col gap-2 sm:gap-3">
              {isLoggedIn ? (
                <button
                  onClick={handleAction}
                  className="group w-full px-6 sm:px-8 py-2.5 sm:py-3.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 font-bold rounded-lg sm:rounded-xl hover:shadow-lg hover:shadow-yellow-500/30 transition-all transform hover:scale-105 flex items-center justify-center text-sm sm:text-base"
                >
                  立即开通代理商
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="group w-full px-6 sm:px-8 py-2.5 sm:py-3.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 font-bold rounded-lg sm:rounded-xl hover:shadow-lg hover:shadow-yellow-500/30 transition-all transform hover:scale-105 flex items-center justify-center text-sm sm:text-base"
                >
                  立即开通代理商
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              )}
              <button
                onClick={handleClose}
                className="w-full px-4 sm:px-6 py-2 sm:py-3.5 bg-white/10 text-white font-medium rounded-lg sm:rounded-xl hover:bg-white/20 transition-all border border-white/10 text-sm sm:text-base"
              >
                稍后再说
              </button>
            </div>

            {/* 底部提示 */}
            <div className="mt-2 sm:mt-5 pt-2 sm:pt-4 border-t border-white/10">
              <p className="text-center text-purple-300 text-[10px] sm:text-xs">
                💡 已有账号？登录后在「个人中心」→「代理商」开通
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 自定义动画样式 */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
