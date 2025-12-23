import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* 导航栏 */}
      <nav className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                GEO优化系统
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-300"
              >
                登录系统
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              让您的品牌
            </span>
            <br />
            <span className="text-gray-900">在AI时代脱颖而出</span>
          </h1>
          <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
            专业的品牌AI推荐优化工具，提升在ChatGPT、Claude、Gemini等AI平台的主动推荐率
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              to="/login"
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg rounded-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              立即开始
            </Link>
          </div>
        </div>

        {/* 功能特点 */}
        <div className="mt-32 grid md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">🎯</span>
            </div>
            <h3 className="text-xl font-bold mb-3">智能关键词蒸馏</h3>
            <p className="text-gray-600">
              分析关键词搜索意图，生成真实用户提问，基于真实搜索行为优化内容
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">✨</span>
            </div>
            <h3 className="text-xl font-bold mb-3">AI驱动内容生成</h3>
            <p className="text-gray-600">
              支持多个AI模型，自动生成高质量SEO文章，智能引用企业知识库
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-pink-600 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">🔄</span>
            </div>
            <h3 className="text-xl font-bold mb-3">批量任务管理</h3>
            <p className="text-gray-600">
              批量生成文章，任务状态监控，智能选择蒸馏结果，提高工作效率
            </p>
          </div>
        </div>

        {/* 核心优势 */}
        <div className="mt-32">
          <h2 className="text-4xl font-bold text-center mb-16">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              核心优势
            </span>
          </h2>
          <div className="grid md:grid-cols-2 gap-12">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold">✓</span>
              </div>
              <div>
                <h4 className="text-lg font-semibold mb-2">多模型AI支持</h4>
                <p className="text-gray-600">
                  支持DeepSeek、Gemini、本地Ollama等多种AI模型，灵活切换，数据安全
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-bold">✓</span>
              </div>
              <div>
                <h4 className="text-lg font-semibold mb-2">企业知识库</h4>
                <p className="text-gray-600">
                  支持多种文档格式，全文搜索，AI生成时智能引用，提升内容专业度
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                <span className="text-pink-600 font-bold">✓</span>
              </div>
              <div>
                <h4 className="text-lg font-semibold mb-2">企业图库</h4>
                <p className="text-gray-600">
                  相册管理，批量上传，文章自动配图，提升内容视觉效果
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                <span className="text-indigo-600 font-bold">✓</span>
              </div>
              <div>
                <h4 className="text-lg font-semibold mb-2">转化目标管理</h4>
                <p className="text-gray-600">
                  支持电话、邮箱、网址、微信等多种转化目标，文章中自然嵌入
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-32 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">准备好提升品牌影响力了吗？</h2>
          <p className="text-xl mb-8 opacity-90">
            立即登录，开始使用GEO优化系统
          </p>
          <Link
            to="/login"
            className="inline-block px-8 py-4 bg-white text-blue-600 text-lg font-semibold rounded-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            登录系统
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            © 2024 GEO优化系统. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
