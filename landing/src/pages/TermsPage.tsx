import Header from '../components/Header';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* 导航栏 */}
      <Header />

      {/* 内容区域 */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">服务条款</h1>
        <p className="text-gray-500 mb-8">最后更新日期：2024年12月23日</p>

        <div className="prose prose-lg max-w-none">
          {/* 引言 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">引言</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              欢迎使用GEO优化系统（以下简称"本服务"）。本服务由深圳微暖教育科技有限公司（以下简称"我们"或"公司"）提供。
            </p>
            <p className="text-gray-600 leading-relaxed">
              在使用本服务之前，请您仔细阅读并理解本服务条款（以下简称"本条款"）。使用本服务即表示您同意接受本条款的约束。如果您不同意本条款，请不要使用本服务。
            </p>
          </section>

          {/* 服务说明 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. 服务说明</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              GEO优化系统是一款基于AI技术的内容生成与发布管理平台，主要功能包括：
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>智能关键词蒸馏与分析</li>
              <li>AI驱动的内容生成</li>
              <li>企业知识库管理</li>
              <li>多平台内容发布</li>
              <li>数据分析与监控</li>
            </ul>
          </section>

          {/* 账户注册 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. 账户注册与使用</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">2.1 注册要求</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
              <li>您必须年满18周岁或具有完全民事行为能力</li>
              <li>提供真实、准确、完整的注册信息</li>
              <li>及时更新您的账户信息</li>
              <li>一个邮箱或手机号只能注册一个账户</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">2.2 账户安全</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
              <li>您有责任保管好账户密码和登录凭证</li>
              <li>不得将账户转让、出售或出借给他人</li>
              <li>如发现账户被盗用，应立即通知我们</li>
              <li>您对账户下的所有活动承担责任</li>
            </ul>
          </section>

          {/* 服务套餐 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. 服务套餐与费用</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">3.1 套餐类型</h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              我们提供体验版、专业版和企业版三种服务套餐，各套餐的功能和限制详见价格页面。
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">3.2 付费与续费</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
              <li>付费套餐按月计费，需提前支付</li>
              <li>支持自动续费，可随时取消</li>
              <li>价格可能会调整，调整前会提前通知</li>
              <li>已支付费用不予退还，除非法律另有规定</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">3.3 免费试用</h3>
            <p className="text-gray-600 leading-relaxed">
              体验版提供免费试用，试用期间享有基础功能。我们保留随时修改或终止免费试用的权利。
            </p>
          </section>

          {/* 用户行为规范 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. 用户行为规范</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              在使用本服务时，您不得：
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>发布违法、有害、虚假、侵权或不当内容</li>
              <li>侵犯他人知识产权、隐私权或其他合法权益</li>
              <li>传播病毒、恶意代码或进行网络攻击</li>
              <li>滥用服务资源或进行批量注册</li>
              <li>干扰或破坏服务的正常运行</li>
              <li>使用自动化工具或机器人访问服务</li>
              <li>逆向工程、反编译或破解服务</li>
              <li>将服务用于非法或未经授权的目的</li>
            </ul>
          </section>

          {/* 知识产权 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. 知识产权</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">5.1 平台权利</h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              本服务的所有内容（包括但不限于软件、代码、界面设计、文字、图片、商标、Logo）的知识产权归我们或相关权利人所有。
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">5.2 用户内容</h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              您保留对上传内容的所有权。但您授予我们在提供服务所需范围内使用、存储、处理您内容的非独占许可。
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">5.3 AI生成内容</h3>
            <p className="text-gray-600 leading-relaxed">
              通过本服务生成的内容归您所有，但您需确保使用这些内容时遵守相关法律法规和第三方权利。
            </p>
          </section>

          {/* 服务变更与中断 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. 服务变更与中断</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              我们保留以下权利：
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>随时修改、暂停或终止部分或全部服务</li>
              <li>调整服务功能、限制或价格</li>
              <li>进行系统维护和升级</li>
              <li>因不可抗力导致的服务中断</li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-4">
              重大变更会提前通知，但紧急情况除外。
            </p>
          </section>

          {/* 免责声明 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. 免责声明</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>本服务按"现状"提供，不保证完全无错误或不中断</li>
              <li>AI生成的内容可能存在不准确或不适当的情况</li>
              <li>我们不对用户内容的合法性、准确性负责</li>
              <li>不对因使用本服务导致的任何损失承担责任</li>
              <li>不对第三方服务或链接的内容负责</li>
              <li>不保证服务满足您的特定需求</li>
            </ul>
          </section>

          {/* 责任限制 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. 责任限制</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              在法律允许的最大范围内：
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>我们的总责任不超过您在过去12个月内支付的服务费用</li>
              <li>不对间接、偶然、特殊或惩罚性损害承担责任</li>
              <li>不对利润损失、数据丢失或业务中断负责</li>
            </ul>
          </section>

          {/* 账户终止 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. 账户终止</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3">9.1 用户终止</h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              您可以随时注销账户或停止使用服务。注销后，您的数据将被删除且无法恢复。
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">9.2 平台终止</h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              如果您违反本条款，我们有权暂停或终止您的账户，且不予退款。
            </p>
          </section>

          {/* 争议解决 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. 争议解决</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              本条款受中华人民共和国法律管辖。因本条款引起的任何争议，双方应友好协商解决；协商不成的，任何一方可向公司所在地人民法院提起诉讼。
            </p>
          </section>

          {/* 其他条款 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">11. 其他条款</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>本条款构成您与我们之间的完整协议</li>
              <li>如部分条款无效，不影响其他条款的效力</li>
              <li>我们未行使权利不构成放弃该权利</li>
              <li>本条款的标题仅为方便阅读，不影响解释</li>
            </ul>
          </section>

          {/* 条款更新 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">12. 条款更新</h2>
            <p className="text-gray-600 leading-relaxed">
              我们可能会不时更新本条款。重大变更时会通过网站公告、邮件或其他方式通知您。继续使用服务即表示您接受更新后的条款。
            </p>
          </section>

          {/* 联系我们 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">13. 联系我们</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              如果您对本服务条款有任何疑问，请联系我们：
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
