import Header from '../components/Header';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* 导航栏 */}
      <Header />

      {/* 内容区域 */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">隐私政策</h1>
        <p className="text-gray-500 mb-8">最后更新日期：2024年12月23日</p>

        <div className="prose prose-lg max-w-none">
          {/* 引言 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">引言</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              深圳微暖教育科技有限公司（以下简称"我们"）非常重视用户的隐私保护。本隐私政策旨在向您说明我们如何收集、使用、存储和保护您的个人信息，以及您享有的相关权利。
            </p>
            <p className="text-gray-600 leading-relaxed">
              在使用GEO优化系统（以下简称"本服务"）之前，请您仔细阅读并充分理解本隐私政策。如果您不同意本政策的任何内容，请不要使用本服务。
            </p>
          </section>

          {/* 信息收集 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. 我们收集的信息</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">1.1 您主动提供的信息</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
              <li>账户信息：注册时提供的用户名、邮箱、手机号码等</li>
              <li>企业信息：公司名称、行业类型、联系方式等</li>
              <li>内容数据：您上传的企业知识库、图片、文章等内容</li>
              <li>支付信息：订单信息、支付方式等（支付信息由第三方支付平台处理）</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">1.2 自动收集的信息</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
              <li>设备信息：设备型号、操作系统版本、浏览器类型等</li>
              <li>日志信息：IP地址、访问时间、访问页面、操作记录等</li>
              <li>Cookie和类似技术：用于识别您的身份和偏好设置</li>
            </ul>
          </section>

          {/* 信息使用 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. 我们如何使用您的信息</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>提供、维护和改进本服务的功能</li>
              <li>处理您的订单和支付请求</li>
              <li>向您发送服务通知、更新和营销信息</li>
              <li>分析用户行为，优化产品体验</li>
              <li>防止欺诈、滥用和非法活动</li>
              <li>遵守法律法规要求</li>
            </ul>
          </section>

          {/* 信息共享 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. 信息共享与披露</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              我们不会出售、出租或交易您的个人信息。在以下情况下，我们可能会共享您的信息：
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>获得您的明确同意</li>
              <li>与服务提供商共享（如云存储、支付处理、AI模型服务商）</li>
              <li>遵守法律法规、法院命令或政府要求</li>
              <li>保护我们或他人的合法权益</li>
              <li>企业合并、收购或资产转让时</li>
            </ul>
          </section>

          {/* 数据安全 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. 数据安全</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              我们采取合理的技术和管理措施保护您的个人信息安全：
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>使用SSL/TLS加密传输数据</li>
              <li>对敏感信息进行加密存储</li>
              <li>实施严格的访问控制和权限管理</li>
              <li>定期进行安全审计和漏洞扫描</li>
              <li>建立数据备份和灾难恢复机制</li>
            </ul>
          </section>

          {/* 数据保留 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. 数据保留</h2>
            <p className="text-gray-600 leading-relaxed">
              我们仅在实现本政策所述目的所需的期限内保留您的个人信息。当您注销账户或要求删除数据时，我们将在合理期限内删除或匿名化您的信息，除非法律法规要求我们保留。
            </p>
          </section>

          {/* 用户权利 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. 您的权利</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              根据适用的法律法规，您享有以下权利：
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>访问权：查看我们持有的您的个人信息</li>
              <li>更正权：更正不准确或不完整的信息</li>
              <li>删除权：要求删除您的个人信息</li>
              <li>限制处理权：限制我们处理您的信息</li>
              <li>数据可携权：以结构化格式获取您的数据</li>
              <li>撤回同意权：随时撤回您的同意</li>
              <li>投诉权：向监管机构投诉</li>
            </ul>
          </section>

          {/* Cookie政策 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Cookie和类似技术</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              我们使用Cookie和类似技术来改善用户体验、分析网站流量和提供个性化内容。您可以通过浏览器设置管理Cookie偏好，但这可能影响某些功能的使用。
            </p>
          </section>

          {/* 第三方服务 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. 第三方服务</h2>
            <p className="text-gray-600 leading-relaxed">
              本服务可能包含第三方网站或服务的链接。我们不对这些第三方的隐私实践负责。建议您查看这些第三方的隐私政策。
            </p>
          </section>

          {/* 未成年人保护 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. 未成年人保护</h2>
            <p className="text-gray-600 leading-relaxed">
              本服务面向企业用户，不针对18岁以下的未成年人。如果我们发现在未经父母或监护人同意的情况下收集了未成年人的信息，我们将采取措施尽快删除。
            </p>
          </section>

          {/* 政策更新 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. 隐私政策更新</h2>
            <p className="text-gray-600 leading-relaxed">
              我们可能会不时更新本隐私政策。重大变更时，我们会通过网站公告、邮件或其他方式通知您。继续使用本服务即表示您接受更新后的政策。
            </p>
          </section>

          {/* 联系我们 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">11. 联系我们</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              如果您对本隐私政策有任何疑问、意见或投诉，请通过以下方式联系我们：
            </p>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="text-gray-900 font-semibold mb-2">深圳微暖教育科技有限公司</p>
              <p className="text-gray-600">我们将在收到您的请求后15个工作日内回复。</p>
            </div>
          </section>
        </div>
      </div>

      {/* 页脚 */}
      <footer className="bg-gray-50 border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
          <p>© 2024 深圳微暖教育科技有限公司. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
