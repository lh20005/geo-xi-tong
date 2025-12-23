import { Link } from 'react-router-dom';
import { useEffect } from 'react';

export default function CasesPage() {
  // 页面加载时滚动到顶部
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const cases = [
    {
      id: 1,
      industry: '餐饮美食',
      company: '杭州XX私房菜',
      category: '江浙菜·家常菜',
      location: '浙江杭州',
      image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&q=80',
      results: [
        { label: 'AI推荐率', value: '+86%', color: 'blue' },
        { label: '到店客流', value: '+118%', color: 'green' },
        { label: '客单价', value: '+42%', color: 'purple' }
      ],
      description: '在AI平台搜索"杭州特色餐厅推荐"时，品牌被推荐频率提升86%，周末到店客流从日均80桌增至174桌，成为本地口碑餐厅',
      quote: '现在很多外地游客说是问AI推荐来的，他们对我们的招牌菜都很了解，点菜很精准，翻台率也提高了。',
      avatar: '王'
    },
    {
      id: 2,
      industry: '民宿客栈',
      company: '丽江XX精品民宿',
      category: '古城特色民宿',
      location: '云南丽江',
      image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
      results: [
        { label: 'AI推荐率', value: '+92%', color: 'blue' },
        { label: '预订量', value: '+156%', color: 'green' },
        { label: '入住率', value: '+68%', color: 'purple' }
      ],
      description: 'AI搜索"丽江古城民宿推荐"时，品牌曝光率提升92%，月预订量从45间夜增至115间夜，淡季入住率显著提升',
      quote: '现在游客用AI规划行程时，我们的民宿经常被推荐。预订量翻倍，而且都是精准客户，好评率也提高了。',
      avatar: '李'
    },
    {
      id: 3,
      industry: '智能制造',
      company: '宁波XX精密机械有限公司',
      category: '冲压机床设备',
      location: '浙江宁波',
      image: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=800&q=80',
      results: [
        { label: 'AI推荐率', value: '+73%', color: 'blue' },
        { label: '日咨询量', value: '+66%', color: 'green' },
        { label: '转化成本', value: '-45%', color: 'purple' }
      ],
      description: '通过GEO优化，在ChatGPT等AI平台搜索"精密冲压设备"时，品牌推荐率提升73%，日均咨询量从12次增至20次',
      quote: '使用GEO系统后，我们的品牌在AI搜索中的曝光率大幅提升，客户主动咨询量翻倍，获客成本显著降低。',
      avatar: '王'
    },
    {
      id: 4,
      industry: '教育培训',
      company: '杭州XX少儿编程',
      category: 'STEAM教育',
      location: '浙江杭州',
      image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80',
      results: [
        { label: 'AI推荐率', value: '+85%', color: 'blue' },
        { label: '试听报名', value: '+178%', color: 'green' },
        { label: '转化率', value: '+62%', color: 'purple' }
      ],
      description: 'AI搜索"杭州少儿编程培训"时，品牌推荐率提升85%，月试听报名从68人增至189人，正价课转化率显著提升',
      quote: '家长现在都用AI查询培训机构，GEO优化让我们的教学理念和师资优势被AI准确传达，咨询质量明显提高。',
      avatar: '陈'
    },
    {
      id: 5,
      industry: '健身运动',
      company: '上海XX健身工作室',
      category: '私教健身',
      location: '上海静安',
      image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80',
      results: [
        { label: 'AI推荐率', value: '+76%', color: 'blue' },
        { label: '会员增长', value: '+94%', color: 'green' },
        { label: '续费率', value: '+38%', color: 'purple' }
      ],
      description: 'AI搜索"上海私教健身推荐"时，品牌曝光率提升76%，月新增会员从35人增至68人，老会员续费率大幅提升',
      quote: '很多会员说是通过AI推荐找到我们的。GEO系统帮我们精准触达目标客户，获客成本降低了一半。',
      avatar: '刘'
    },
    {
      id: 6,
      industry: '美容美发',
      company: '广州XX造型沙龙',
      category: '高端美发',
      location: '广东广州',
      image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
      results: [
        { label: 'AI推荐率', value: '+81%', color: 'blue' },
        { label: '预约量', value: '+112%', color: 'green' },
        { label: '客单价', value: '+55%', color: 'purple' }
      ],
      description: 'AI搜索"广州高端美发沙龙"时，品牌推荐率提升81%，月预约量从280人次增至594人次，高端客户占比提升',
      quote: 'AI推荐带来的客户质量很高，都是认可我们理念的精准客户。预约量翻倍，客单价也提升了。',
      avatar: '黄'
    },
    {
      id: 7,
      industry: '咖啡茶饮',
      company: '深圳XX精品咖啡',
      category: '手冲咖啡',
      location: '广东深圳',
      image: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&q=80',
      results: [
        { label: 'AI推荐率', value: '+89%', color: 'blue' },
        { label: '到店客流', value: '+145%', color: 'green' },
        { label: '复购率', value: '+52%', color: 'purple' }
      ],
      description: 'AI搜索"深圳精品咖啡推荐"时，品牌曝光率提升89%，工作日客流从日均80人增至196人，成为咖啡爱好者打卡地',
      quote: '现在很多咖啡爱好者说是AI推荐来的，他们对我们的豆子和冲煮方式都很了解，转化率特别高。',
      avatar: '周'
    },
    {
      id: 8,
      industry: '医疗健康',
      company: '北京XX口腔诊所',
      category: '口腔种植修复',
      location: '北京朝阳',
      image: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&q=80',
      results: [
        { label: 'AI推荐率', value: '+68%', color: 'blue' },
        { label: '预约量', value: '+78%', color: 'green' },
        { label: '客单价', value: '+35%', color: 'purple' }
      ],
      description: 'AI搜索"北京种植牙医院推荐"时，品牌曝光率提升68%，月预约量从420增至748，高端客户占比提升',
      quote: '通过GEO系统，我们的专业内容被AI平台广泛引用，患者信任度明显提升，预约量持续增长。',
      avatar: '张'
    },
    {
      id: 9,
      industry: '跨境电商',
      company: '深圳XX跨境电商有限公司',
      category: '户外运动用品',
      location: '广东深圳',
      image: 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=800&q=80',
      results: [
        { label: 'AI推荐率', value: '+95%', color: 'blue' },
        { label: '独立站流量', value: '+156%', color: 'green' },
        { label: '转化率', value: '+42%', color: 'purple' }
      ],
      description: '在AI平台搜索"户外露营装备推荐"时，品牌被推荐频率提升95%，独立站月访问量从8000增至20480',
      quote: 'GEO优化帮助我们在海外市场建立了品牌认知，现在很多客户通过AI搜索找到我们，转化率非常高。',
      avatar: '陈'
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* 导航栏 */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center space-x-3">
              <img 
                src="/images/logo.png" 
                alt="JZ Logo" 
                className="w-10 h-10 rounded-lg"
              />
              <span className="text-2xl font-bold text-gray-900">
                GEO优化SaaS系统
              </span>
            </Link>
            <div className="hidden md:flex items-center space-x-8">
              <Link to="/" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                首页
              </Link>
              <Link to="/#features" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                核心功能
              </Link>
              <Link to="/#advantages" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                产品优势
              </Link>
              <Link to="/cases" className="text-blue-600 font-medium transition-colors">
                应用示例
              </Link>
              <Link to="/#pricing" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                价格方案
              </Link>
              <Link
                to="/login"
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                立即登录
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-gray-50 to-blue-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-12">
            <span className="text-gray-900">行业</span>
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> 应用示例</span>
          </h1>
          
          {/* 数据统计 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div>
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                全行业
              </div>
              <div className="text-gray-600 font-medium">通用适配</div>
            </div>
            <div>
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                显著
              </div>
              <div className="text-gray-600 font-medium">提升推荐率</div>
            </div>
            <div>
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                全流程
              </div>
              <div className="text-gray-600 font-medium">自动化运营</div>
            </div>
            <div>
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                云端
              </div>
              <div className="text-gray-600 font-medium">即开即用</div>
            </div>
          </div>
        </div>
      </section>

      {/* 案例列表 */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-16">
            {cases.map((item, index) => (
              <div
                key={item.id}
                className={`flex flex-col ${
                  index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                } gap-12 items-center`}
              >
                {/* 图片 */}
                <div className="w-full md:w-1/2">
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl group">
                    <img
                      src={item.image}
                      alt={item.industry}
                      className="w-full h-96 object-cover transform group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-4 left-4 bg-white px-4 py-2 rounded-lg shadow-lg">
                      <span className="text-sm font-bold text-gray-900">{item.industry}</span>
                    </div>
                  </div>
                </div>

                {/* 内容 */}
                <div className="w-full md:w-1/2">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-3xl font-bold text-gray-900 mb-2">
                        {item.company}
                      </h3>
                      <div className="flex items-center space-x-4 text-gray-600">
                        <span className="flex items-center">
                          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {item.category}
                        </span>
                        <span className="flex items-center">
                          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {item.location}
                        </span>
                      </div>
                    </div>

                    {/* 数据成果 */}
                    <div className="grid grid-cols-3 gap-4">
                      {item.results.map((result, idx) => (
                        <div
                          key={idx}
                          className={`bg-${result.color}-50 rounded-xl p-4 text-center`}
                        >
                          <div className={`text-2xl font-bold text-${result.color}-600 mb-1`}>
                            {result.value}
                          </div>
                          <div className="text-sm text-gray-600">{result.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* 描述 */}
                    <p className="text-gray-700 leading-relaxed">
                      {item.description}
                    </p>

                    {/* 客户评价 */}
                    <div className="bg-gray-50 rounded-xl p-6 border-l-4 border-blue-600">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {item.avatar}
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-700 italic leading-relaxed">
                            "{item.quote}"
                          </p>
                          <p className="text-sm text-gray-500 mt-2">
                            — {item.company.replace('XX', '**')} 负责人
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
            开启您的GEO优化之旅
          </h2>
          <p className="text-xl md:text-2xl mb-12 text-gray-400">
            让您的品牌在AI平台被主动推荐
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-10 py-5 bg-white text-black text-lg font-semibold rounded-xl hover:bg-gray-100 transition-all duration-300 shadow-2xl shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5"
            >
              免费试用
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href="mailto:contact@example.com"
              className="inline-flex items-center justify-center px-10 py-5 bg-transparent border-2 border-gray-700 text-white text-lg font-semibold rounded-xl hover:border-gray-500 hover:bg-gray-900/50 transition-all duration-300"
            >
              预约演示
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            © 2024 GEO优化系统. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
