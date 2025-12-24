import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Header from '../components/Header';

export default function HomePage() {
  const [activeSection, setActiveSection] = useState('home');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // 轮播图片列表
  const carouselImages = [
    {
      src: '/images/dashboard.png',
      alt: 'GEO优化系统数据工作台'
    },
    {
      src: '/images/dashboard-2.png',
      alt: 'GEO优化系统功能界面'
    },
    {
      src: '/images/dashboard-3.png',
      alt: 'GEO优化系统分析报告'
    }
  ];

  // 自动轮播
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => 
        (prevIndex + 1) % carouselImages.length
      );
    }, 5000); // 每5秒切换一次

    return () => clearInterval(interval);
  }, [carouselImages.length]);

  // 手动切换到指定图片
  const goToImage = (index: number) => {
    setCurrentImageIndex(index);
  };

  // 处理URL hash跳转
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      // 延迟一下确保DOM已加载
      setTimeout(() => {
        const element = document.querySelector(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['features', 'advantages', 'cases', 'pricing'];
      const scrollPosition = window.scrollY + 100; // 偏移量，考虑导航栏高度

      // 如果在页面顶部，设置为home
      if (window.scrollY < 200) {
        setActiveSection('home');
        return;
      }

      // 检查每个section
      for (const sectionId of sections) {
        const element = document.getElementById(sectionId);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(sectionId);
            return;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // 初始化

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* 导航栏 */}
      <Header activeSection={activeSection} />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-blue-50 pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* 左侧文字内容 */}
            <div className="flex flex-col items-center text-center">
              {/* 标签 */}
              <div className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-700 mb-6 shadow-sm">
                <svg className="w-3.5 h-3.5 mr-1.5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                </svg>
                基于普林斯顿大学GEO研究方法论的SaaS系统
              </div>
              
              {/* 主标题 */}
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-relaxed tracking-tight">
                让品牌在AI时代
                <br />
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent mt-2 inline-block">
                  被主动推荐
                </span>
              </h1>
              
              {/* 核心数据 */}
              <div className="flex flex-wrap items-center justify-center gap-4 mb-8 text-gray-700">
                <div className="flex items-center gap-1.5">
                  <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">显著</span>
                  <span className="text-xs">提升推荐率</span>
                </div>
                <div className="w-px h-6 bg-gray-300"></div>
                <div className="flex items-center gap-1.5">
                  <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">10倍</span>
                  <span className="text-xs">效率提升</span>
                </div>
                <div className="w-px h-6 bg-gray-300"></div>
                <div className="flex items-center gap-1.5">
                  <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">云端</span>
                  <span className="text-xs">即开即用</span>
                </div>
              </div>
              
              {/* CTA按钮 */}
              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <Link
                  to="/login"
                  className="group px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-base font-semibold rounded-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
                >
                  免费开始
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>

              {/* 信任标识 */}
              <div className="pt-6 border-t border-gray-200 w-full max-w-xl">
                <p className="text-sm text-gray-500 mb-4">适用于所有行业，从本地生活到B2B企业</p>
                <div className="flex flex-wrap items-center justify-center gap-4 text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">支持免费使用</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">云端SaaS系统</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">在线随时使用</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">GEO软件专业界面</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 右侧图片轮播 */}
            <div className="relative lg:flex hidden items-center group">
              <div className="relative z-10 overflow-hidden rounded-2xl shadow-2xl w-full">
                {/* 图片容器 - 16:9 比例 */}
                <div className="relative aspect-[16/9]">
                  {carouselImages.map((image, index) => (
                    <div
                      key={index}
                      className={`absolute inset-0 transition-opacity duration-1000 ${
                        index === currentImageIndex ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      <img
                        src={image.src}
                        alt={image.alt}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>

                {/* 导航点 */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-20">
                  {carouselImages.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToImage(index)}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        index === currentImageIndex
                          ? 'bg-white w-8'
                          : 'bg-white/50 hover:bg-white/75'
                      }`}
                      aria-label={`切换到第 ${index + 1} 张图片`}
                    />
                  ))}
                </div>

                {/* 左右切换按钮 */}
                <button
                  onClick={() => goToImage((currentImageIndex - 1 + carouselImages.length) % carouselImages.length)}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 rounded-full p-2 transition-all duration-300 opacity-0 group-hover:opacity-100 z-20"
                  aria-label="上一张"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => goToImage((currentImageIndex + 1) % carouselImages.length)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 rounded-full p-2 transition-all duration-300 opacity-0 group-hover:opacity-100 z-20"
                  aria-label="下一张"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* 装饰元素 */}
              <div className="absolute -top-6 -right-6 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
              <div className="absolute -bottom-6 -left-6 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
            </div>
          </div>
        </div>

        {/* 背景装饰元素 */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </section>

      {/* 核心功能 */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              全流程<span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">AI</span>优化<span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">SaaS</span>系统
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              从关键词分析到内容生成，从AI优化到多平台自动发布，一站式解决品牌AI曝光难题
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* 功能1：智能关键词蒸馏 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <span className="text-3xl">🎯</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">智能关键词蒸馏</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                AI驱动的关键词意图分析，自动生成真实用户提问场景，精准把握搜索需求，覆盖用户真实查询路径
              </p>
              <ul className="space-y-2 text-sm text-gray-600 text-left inline-block">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">✓</span>
                  <span>自动分析关键词背后的用户意图</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">✓</span>
                  <span>生成多角度真实提问场景</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">✓</span>
                  <span>支持批量蒸馏，提升效率</span>
                </li>
              </ul>
            </div>

            {/* 功能2：AI内容生成引擎 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <span className="text-3xl">✨</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">AI内容生成引擎</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                集成AI大模型，结合专业GEO优化流程和内容要求，批量生成高质量GEO优化文章，自动融合企业知识库和品牌信息
              </p>
              <ul className="space-y-2 text-sm text-gray-600 text-left inline-block">
                <li className="flex items-start">
                  <span className="text-purple-600 mr-2">✓</span>
                  <span>AI模型自动调用最新GEO知识库</span>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-600 mr-2">✓</span>
                  <span>自动引用企业知识库内容</span>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-600 mr-2">✓</span>
                  <span>批量生成，任务自动执行</span>
                </li>
              </ul>
            </div>

            {/* 功能3：企业知识库管理 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <span className="text-3xl">📚</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">企业知识库管理</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                统一管理企业知识内容和图片资源，AI生成文章时自动引用，确保品牌信息准确传达，提升内容专业度和可信度
              </p>
              <ul className="space-y-2 text-sm text-gray-600 text-left inline-block">
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>企业知识库分类管理</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>企业图库相册组织</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>生成时智能引用资源</span>
                </li>
              </ul>
            </div>

            {/* 功能4：转化目标设置 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <span className="text-3xl">🎪</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">转化目标设置</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                配置企业信息（官网、电话、地址），AI生成内容时自动嵌入转化目标，从AI推荐到客户咨询，形成完整营销闭环
              </p>
              <ul className="space-y-2 text-sm text-gray-600 text-left inline-block">
                <li className="flex items-start">
                  <span className="text-pink-600 mr-2">✓</span>
                  <span>设置公司名称和行业信息</span>
                </li>
                <li className="flex items-start">
                  <span className="text-pink-600 mr-2">✓</span>
                  <span>配置官网、电话、地址</span>
                </li>
                <li className="flex items-start">
                  <span className="text-pink-600 mr-2">✓</span>
                  <span>自动嵌入文章，引导转化</span>
                </li>
              </ul>
            </div>

            {/* 功能5：多平台智能发布 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <span className="text-3xl">🚀</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">多平台智能发布</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                一键发布到头条、抖音、网易号等主流平台，支持定时发布、批量发布、静默模式，全流程自动化运营，解放人力
              </p>
              <ul className="space-y-2 text-sm text-gray-600 text-left inline-block">
                <li className="flex items-start">
                  <span className="text-orange-600 mr-2">✓</span>
                  <span>支持头条、抖音、微信等平台</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-600 mr-2">✓</span>
                  <span>定时发布、批量发布</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-600 mr-2">✓</span>
                  <span>静默模式后台自动运行</span>
                </li>
              </ul>
            </div>

            {/* 功能6：数据监控工作台 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <span className="text-3xl">📊</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">数据监控工作台</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                实时展示关键指标和趋势图表，文章生成、发布状态一目了然，数据驱动优化决策，持续提升GEO效果
              </p>
              <ul className="space-y-2 text-sm text-gray-600 text-left inline-block">
                <li className="flex items-start">
                  <span className="text-indigo-600 mr-2">✓</span>
                  <span>核心指标卡片实时更新</span>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-600 mr-2">✓</span>
                  <span>趋势图表可视化分析</span>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-600 mr-2">✓</span>
                  <span>快速入口便捷操作</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 功能流程图 */}
          <div className="mt-20 bg-gradient-to-br from-gray-50 to-blue-50 rounded-3xl p-12">
            <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
              完整的<span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">GEO优化工作流</span>
            </h3>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1 text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">1</div>
                <h4 className="font-bold text-gray-900 mb-2">关键词蒸馏</h4>
                <p className="text-sm text-gray-600">AI分析用户意图</p>
              </div>
              <div className="hidden md:block text-gray-400 text-2xl">→</div>
              <div className="flex-1 text-center">
                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">2</div>
                <h4 className="font-bold text-gray-900 mb-2">内容生成</h4>
                <p className="text-sm text-gray-600">AI批量创作文章</p>
              </div>
              <div className="hidden md:block text-gray-400 text-2xl">→</div>
              <div className="flex-1 text-center">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">3</div>
                <h4 className="font-bold text-gray-900 mb-2">知识融合</h4>
                <p className="text-sm text-gray-600">引用企业专属知识库</p>
              </div>
              <div className="hidden md:block text-gray-400 text-2xl">→</div>
              <div className="flex-1 text-center">
                <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">4</div>
                <h4 className="font-bold text-gray-900 mb-2">多平台发布</h4>
                <p className="text-sm text-gray-600">自动分发内容</p>
              </div>
              <div className="hidden md:block text-gray-400 text-2xl">→</div>
              <div className="flex-1 text-center">
                <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">5</div>
                <h4 className="font-bold text-gray-900 mb-2">数据监控</h4>
                <p className="text-sm text-gray-600">持续优化效果</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 产品优势 */}
      <section id="advantages" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              为什么选择<span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">我们的SaaS系统</span>？
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              基于科学方法论，融合AI技术，打造全流程的GEO优化SaaS系统解决方案
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {/* 第一行 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl">🧠</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">科学的GEO方法论</h3>
                  <p className="text-gray-600 leading-relaxed">
                    基于普林斯顿大学GEO研究论文，采用经过验证的优化策略，显著提升品牌在AI平台的推荐频率
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl">🎯</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">智能关键词蒸馏</h3>
                  <p className="text-gray-600 leading-relaxed">
                    AI驱动的关键词意图分析，自动生成真实用户提问，精准把握搜索需求，覆盖用户真实场景
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl">🤖</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">大模型AI引擎</h3>
                  <p className="text-gray-600 leading-relaxed">
                    应用DeepSeek大模型，为关键词蒸馏及文章撰写提供强大支持，融合GEO专业数据训练，大模型性能更优，满足不同场景需求
                  </p>
                </div>
              </div>
            </div>

            {/* 第二行 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-14 h-14 bg-yellow-100 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl">✨</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">企业知识库融合</h3>
                  <p className="text-gray-600 leading-relaxed">
                    自动引用企业知识库和图库资源，生成的内容深度融合品牌信息，确保AI推荐时准确传达品牌价值
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl">🎪</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">精准转化闭环</h3>
                  <p className="text-gray-600 leading-relaxed">
                    智能嵌入转化目标（官网、电话、地址），从AI推荐到客户咨询，形成完整营销闭环，提升转化率
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl">⚡</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">10倍效率提升</h3>
                  <p className="text-gray-600 leading-relaxed">
                    从关键词分析到内容生成，从多平台发布到数据监控，全流程自动化，让1个人完成10个人的工作
                  </p>
                </div>
              </div>
            </div>

            {/* 第三行 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-14 h-14 bg-pink-100 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl">🚀</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">多平台智能发布</h3>
                  <p className="text-gray-600 leading-relaxed">
                    一键发布到头条、抖音、网易号等主流平台，支持定时发布、批量发布、静默模式，全自动运营
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-14 h-14 bg-teal-100 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl">📊</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">实时数据监控</h3>
                  <p className="text-gray-600 leading-relaxed">
                    工作台实时展示关键指标和趋势图表，文章生成、发布状态一目了然，数据驱动优化决策
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl">🔒</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">数据安全可控</h3>
                  <p className="text-gray-600 leading-relaxed">
                    使用国产大模型，企业数据安全有保障，平台登录信息加密存储，Cookie自动管理，安全无忧
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 核心优势总结 */}
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-12 text-white">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold mb-4">抢占AI搜索时代的流量红利</h3>
              <p className="text-xl opacity-90">
                78%的用户已经开始使用AI搜索，传统SEO正在失效，GEO优化是品牌营销的新战场
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-5xl font-bold mb-2">显著</div>
                <div className="text-lg opacity-90">提升推荐率</div>
                <div className="text-sm opacity-75 mt-2">普林斯顿大学研究验证</div>
              </div>
              <div>
                <div className="text-5xl font-bold mb-2">10倍</div>
                <div className="text-lg opacity-90">内容生产效率</div>
                <div className="text-sm opacity-75 mt-2">全流程自动化运营</div>
              </div>
              <div>
                <div className="text-5xl font-bold mb-2">云端</div>
                <div className="text-lg opacity-90">即开即用</div>
                <div className="text-sm opacity-75 mt-2">随时随地访问操作</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 应用示例预览 */}
      <section id="cases" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">行业</span>
              应用示例
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              适用于所有行业，从餐饮民宿到制造医疗，显著提升AI推荐频率
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300">
              <img
                src="https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600&q=80"
                alt="餐饮美食"
                className="w-full h-48 object-cover"
              />
              <div className="p-6 text-center">
                <div className="text-sm text-red-600 font-semibold mb-2">餐饮美食</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">杭州XX私房菜</h3>
                <p className="text-gray-600 mb-4">AI推荐率提升86%，到店客流增长118%</p>
                <div className="flex items-center justify-center text-sm text-gray-500">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  浙江杭州
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300">
              <img
                src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80"
                alt="民宿客栈"
                className="w-full h-48 object-cover"
              />
              <div className="p-6 text-center">
                <div className="text-sm text-orange-600 font-semibold mb-2">民宿客栈</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">丽江XX精品民宿</h3>
                <p className="text-gray-600 mb-4">AI推荐率提升92%，预订量增长156%</p>
                <div className="flex items-center justify-center text-sm text-gray-500">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  云南丽江
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300">
              <img
                src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80"
                alt="健身运动"
                className="w-full h-48 object-cover"
              />
              <div className="p-6 text-center">
                <div className="text-sm text-green-600 font-semibold mb-2">健身运动</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">上海XX健身工作室</h3>
                <p className="text-gray-600 mb-4">AI推荐率提升76%，会员增长94%</p>
                <div className="flex items-center justify-center text-sm text-gray-500">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  上海静安
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link
              to="/cases"
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg font-bold rounded-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
            >
              查看更多案例
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* 价格方案 */}
      <section id="pricing" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              灵活的<span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">价格方案</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* 体验版 */}
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-8 shadow-2xl transform scale-105 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-sm font-bold">
                入门首选
              </div>
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">体验版</h3>
                <p className="text-blue-100 mb-6">适合体验</p>
                <div className="mb-6">
                  <span className="text-5xl font-bold text-white">¥0</span>
                  <span className="text-blue-100">/月</span>
                </div>
                <Link
                  to="/login"
                  className="block w-full py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  免费试用
                </Link>
              </div>
              
              {/* 功能列表 */}
              <div className="border-t border-white/20 pt-6">
                <ul className="space-y-4 text-white">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">每月生成 <span className="font-bold">10篇</span> 文章</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">每月发布 <span className="font-bold">20篇</span> 文章</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">管理 <span className="font-bold">1个</span> 平台账号</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">关键词蒸馏 <span className="font-bold">50个</span></span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">企业知识库 <span className="font-bold">100MB</span></span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">基础数据分析</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">邮件支持</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* 专业版 */}
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-8 shadow-2xl transform scale-105 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-sm font-bold">
                最受欢迎
              </div>
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">专业版</h3>
                <p className="text-blue-100 mb-6">适合个人用户</p>
                <div className="mb-6">
                  <span className="text-5xl font-bold text-white">¥99</span>
                  <span className="text-blue-100">/月</span>
                </div>
                <Link
                  to="/login"
                  className="block w-full py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  点击购买
                </Link>
              </div>
              
              {/* 功能列表 */}
              <div className="border-t border-white/20 pt-6">
                <ul className="space-y-4 text-white">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">每月生成 <span className="font-bold">100篇</span> 文章</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">每月发布 <span className="font-bold">200篇</span> 文章</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">管理 <span className="font-bold">3个</span> 平台账号</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">关键词蒸馏 <span className="font-bold">500个</span></span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">企业知识库 <span className="font-bold">1GB</span></span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">高级数据分析</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">优先技术支持</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* 企业版 */}
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-8 shadow-2xl transform scale-105 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-sm font-bold">
                运营必备
              </div>
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">企业版</h3>
                <p className="text-blue-100 mb-6">适合企业用户</p>
                <div className="mb-6">
                  <span className="text-5xl font-bold text-white">¥299</span>
                  <span className="text-blue-100">/月</span>
                </div>
                <Link
                  to="/login"
                  className="block w-full py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  点击购买
                </Link>
              </div>
              
              {/* 功能列表 */}
              <div className="border-t border-white/20 pt-6">
                <ul className="space-y-4 text-white">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">每月生成 <span className="font-bold">不限</span> 文章</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">每月发布 <span className="font-bold">不限</span> 文章</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">管理 <span className="font-bold">10个</span> 平台账号</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">关键词蒸馏 <span className="font-bold">不限</span></span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">企业知识库 <span className="font-bold">10GB</span></span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">专属数据报告</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">7×24小时专属客服</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 bg-black overflow-hidden">
        {/* 网格背景 */}
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px)`,
          backgroundSize: '64px 64px'
        }}></div>
        
        {/* 渐变光效 - 顶部 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/20 rounded-full blur-[120px]"></div>
        
        {/* 渐变光效 - 底部 */}
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[300px] bg-purple-600/15 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[300px] bg-blue-600/15 rounded-full blur-[100px]"></div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-5xl md:text-6xl font-bold mb-6 text-white">
            准备好抢占AI搜索先机了吗？
          </h2>
          <p className="text-xl md:text-2xl mb-12 text-gray-400 leading-relaxed">
            让您的品牌在豆包、DeepSeek、ChatGPT等AI平台被主动推荐
          </p>
          <Link
            to="/login"
            className="inline-flex items-center px-10 py-5 bg-white text-black text-lg font-semibold rounded-xl hover:bg-gray-100 transition-all duration-300 shadow-2xl shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5"
          >
            立即免费开始
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* 品牌介绍 */}
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <img 
                  src="/images/logo.png" 
                  alt="JZ Logo" 
                  className="w-8 h-8 rounded-lg"
                />
                <span className="text-xl font-bold">GEO优化SaaS系统</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                基于普林斯顿大学GEO研究方法论的SaaS系统，让您的品牌在AI时代被主动推荐
              </p>
            </div>
            
            {/* 产品功能 */}
            <div className="text-center">
              <h4 className="font-bold mb-4 text-lg">产品功能</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><a href="#features" className="hover:text-white transition-colors inline-flex items-center">
                  <span className="mr-2">→</span>智能关键词蒸馏
                </a></li>
                <li><a href="#features" className="hover:text-white transition-colors inline-flex items-center">
                  <span className="mr-2">→</span>AI内容生成引擎
                </a></li>
                <li><a href="#features" className="hover:text-white transition-colors inline-flex items-center">
                  <span className="mr-2">→</span>企业知识库管理
                </a></li>
                <li><a href="#features" className="hover:text-white transition-colors inline-flex items-center">
                  <span className="mr-2">→</span>多平台智能发布
                </a></li>
                <li><a href="#features" className="hover:text-white transition-colors inline-flex items-center">
                  <span className="mr-2">→</span>数据监控工作台
                </a></li>
              </ul>
            </div>
            
            {/* 快速链接 */}
            <div className="text-center">
              <h4 className="font-bold mb-4 text-lg">快速链接</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><a href="#advantages" className="hover:text-white transition-colors inline-flex items-center">
                  <span className="mr-2">→</span>产品优势
                </a></li>
                <li><Link to="/cases" className="hover:text-white transition-colors inline-flex items-center">
                  <span className="mr-2">→</span>应用案例
                </Link></li>
                <li><a href="#pricing" className="hover:text-white transition-colors inline-flex items-center">
                  <span className="mr-2">→</span>价格方案
                </a></li>
                <li><Link to="/login" className="hover:text-white transition-colors inline-flex items-center">
                  <span className="mr-2">→</span>立即登录
                </Link></li>
                <li><a href="#" className="hover:text-white transition-colors inline-flex items-center">
                  <span className="mr-2">→</span>帮助中心
                </a></li>
              </ul>
            </div>
            
            {/* 联系我们 */}
            <div className="text-center">
              <h4 className="font-bold mb-4 text-lg">联系我们</h4>
              <div className="space-y-4 flex flex-col items-center">
                {/* 二维码 */}
                <div className="bg-white p-3 rounded-lg inline-block">
                  <img 
                    src="/images/qrcode.jpg" 
                    alt="微信二维码" 
                    className="w-32 h-32"
                  />
                  <p className="text-xs text-gray-900 text-center mt-2">扫码咨询</p>
                </div>
                
                {/* 公司信息 */}
                <div className="text-sm text-gray-400">
                  <p className="font-semibold text-white">深圳微暖教育科技有限公司</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* 底部版权 */}
          <div className="border-t border-gray-800 pt-8">
            <div className="flex justify-center items-center text-sm text-gray-400">
              <div className="flex space-x-6">
                <Link to="/privacy" className="hover:text-white transition-colors">隐私政策</Link>
                <Link to="/terms" className="hover:text-white transition-colors">服务条款</Link>
                <a href="#" className="hover:text-white transition-colors">ICP备案号</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
