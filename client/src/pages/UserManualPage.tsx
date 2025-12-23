import { useState, useEffect, useRef } from 'react';
import { 
  Card, Typography, Anchor, Steps, Alert, List, Collapse, 
  Input, Button, Space, Tag, Image, Divider 
} from 'antd';
import { 
  BookOutlined, SearchOutlined, PrinterOutlined, 
  CheckCircleOutlined, InfoCircleOutlined, QuestionCircleOutlined,
  RightOutlined, LeftOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import '../styles/manual.css';

const { Title, Paragraph, Text } = Typography;
const { Step } = Steps;
const { Panel } = Collapse;
const { Search } = Input;

export default function UserManualPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number>(0);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // 搜索功能
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentMatchIndex(0);
    
    if (!value.trim()) {
      // 清除高亮
      clearHighlights();
      setSearchResults(0);
      return;
    }

    // 高亮搜索结果
    highlightSearchResults(value);
  };

  // 清除高亮
  const clearHighlights = () => {
    if (contentRef.current) {
      const highlights = contentRef.current.querySelectorAll('.search-highlight');
      highlights.forEach(el => {
        const parent = el.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(el.textContent || ''), el);
          parent.normalize();
        }
      });
    }
  };

  // 高亮搜索结果
  const highlightSearchResults = (query: string) => {
    clearHighlights();
    
    if (!contentRef.current) return;

    const walker = document.createTreeWalker(
      contentRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );

    const nodesToReplace: { node: Node; text: string }[] = [];
    let node;

    while ((node = walker.nextNode())) {
      if (node.textContent && node.textContent.toLowerCase().includes(query.toLowerCase())) {
        nodesToReplace.push({ node, text: node.textContent });
      }
    }

    let matchCount = 0;
    nodesToReplace.forEach(({ node, text }) => {
      const regex = new RegExp(`(${query})`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        matchCount += matches.length;
        const highlightedHTML = text.replace(
          regex,
          '<span class="search-highlight">$1</span>'
        );
        const span = document.createElement('span');
        span.innerHTML = highlightedHTML;
        node.parentNode?.replaceChild(span, node);
      }
    });

    setSearchResults(matchCount);
    
    // 跳转到第一个匹配
    if (matchCount > 0) {
      scrollToMatch(0);
    }
  };

  // 跳转到指定匹配
  const scrollToMatch = (index: number) => {
    const highlights = contentRef.current?.querySelectorAll('.search-highlight');
    if (highlights && highlights.length > 0) {
      const targetIndex = ((index % highlights.length) + highlights.length) % highlights.length;
      
      // 移除当前高亮
      highlights.forEach(el => el.classList.remove('current-match'));
      
      // 添加当前高亮
      highlights[targetIndex].classList.add('current-match');
      highlights[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      setCurrentMatchIndex(targetIndex);
    }
  };

  // 下一个匹配
  const handleNextMatch = () => {
    if (searchResults > 0) {
      scrollToMatch(currentMatchIndex + 1);
    }
  };

  // 上一个匹配
  const handlePrevMatch = () => {
    if (searchResults > 0) {
      scrollToMatch(currentMatchIndex - 1);
    }
  };

  // 打印功能
  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ padding: 24 }}>
      <Card>
        {/* 页面标题 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <BookOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
          <Title level={2} style={{ marginBottom: 8 }}>GEO优化系统使用说明书</Title>
          <Text type="secondary">详细的系统使用指南，帮助您快速上手</Text>
        </div>

        {/* 搜索栏 */}
        <div style={{ marginBottom: 24, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          <Search
            placeholder="搜索说明书内容..."
            allowClear
            enterButton={<SearchOutlined />}
            size="large"
            onSearch={handleSearch}
            onChange={(e) => {
              if (!e.target.value) {
                handleSearch('');
              }
            }}
            style={{ maxWidth: 600 }}
          />
          {searchResults > 0 && (
            <Space>
              <Text type="secondary">
                {currentMatchIndex + 1} / {searchResults}
              </Text>
              <Button icon={<LeftOutlined />} onClick={handlePrevMatch} />
              <Button icon={<RightOutlined />} onClick={handleNextMatch} />
            </Space>
          )}
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>
            打印
          </Button>
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          {/* 目录导航 */}
          <div style={{ width: 240, flexShrink: 0 }} className="manual-toc">
            <Anchor
              offsetTop={80}
              items={[
                {
                  key: 'legal-notice',
                  href: '#legal-notice',
                  title: '使用须知与法律声明',
                },
                {
                  key: 'intro',
                  href: '#intro',
                  title: '系统简介',
                },
                {
                  key: 'quickstart',
                  href: '#quickstart',
                  title: '快速开始',
                },
                {
                  key: 'modules',
                  href: '#modules',
                  title: '功能模块',
                  children: [
                    { key: 'dashboard', href: '#dashboard', title: '工作台' },
                    { key: 'conversion', href: '#conversion', title: '转化目标' },
                    { key: 'distillation', href: '#distillation', title: '关键词蒸馏' },
                    { key: 'results', href: '#results', title: '蒸馏结果' },
                    { key: 'gallery', href: '#gallery', title: '企业图库' },
                    { key: 'knowledge', href: '#knowledge', title: '企业知识库' },
                    { key: 'article-settings', href: '#article-settings', title: '文章设置' },
                    { key: 'generation', href: '#generation', title: '生成文章' },
                    { key: 'articles', href: '#articles', title: '文章管理' },
                    { key: 'platform', href: '#platform', title: '平台登录' },
                    { key: 'tasks', href: '#tasks', title: '发布任务' },
                    { key: 'records', href: '#records', title: '发布记录' },
                  ],
                },
                {
                  key: 'faq',
                  href: '#faq',
                  title: '常见问题',
                },
              ]}
            />
          </div>

          {/* 说明书内容 */}
          <div ref={contentRef} style={{ flex: 1, minWidth: 0 }} className="manual-content">
            {/* 使用须知与法律声明 */}
            <section id="legal-notice">
              <Title level={3}>
                <InfoCircleOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
                使用须知与法律声明
              </Title>
              <Alert
                message="重要提示"
                description="使用本系统前，请务必仔细阅读并遵守以下规定"
                type="error"
                showIcon
                icon={<ExclamationCircleOutlined />}
                style={{ marginBottom: 16 }}
              />
              
              <Paragraph>
                <Text strong style={{ fontSize: 16 }}>一、合法使用承诺</Text>
              </Paragraph>
              <Paragraph>
                用户在使用本系统（以下简称"本系统"）时，必须严格遵守《中华人民共和国网络安全法》《中华人民共和国数据安全法》《中华人民共和国个人信息保护法》《互联网信息服务管理办法》等相关法律法规，以及国家关于互联网信息内容管理的各项规定。
              </Paragraph>

              <Paragraph>
                <Text strong style={{ fontSize: 16 }}>二、禁止发布的内容</Text>
              </Paragraph>
              <Paragraph>
                用户使用本系统生成、编辑或发布任何内容时，严禁包含以下信息：
              </Paragraph>
              <List size="small" bordered>
                <List.Item>
                  <Text strong>1. 危害国家安全：</Text>反对宪法确定的基本原则；危害国家统一、主权和领土完整；泄露国家秘密；颠覆国家政权、推翻社会主义制度；分裂国家、破坏国家统一；损害国家荣誉和利益的内容
                </List.Item>
                <List.Item>
                  <Text strong>2. 虚假信息：</Text>编造、传播虚假信息扰乱经济秩序和社会秩序；散布谣言、虚假广告、虚假宣传等误导公众的内容
                </List.Item>
                <List.Item>
                  <Text strong>3. 违法犯罪：</Text>煽动民族仇恨、民族歧视；宣扬邪教、迷信；散布淫秽、色情、赌博、暴力、凶杀、恐怖或者教唆犯罪的内容
                </List.Item>
                <List.Item>
                  <Text strong>4. 侵犯权益：</Text>侵犯他人知识产权、商业秘密；侵害他人名誉权、隐私权、肖像权等合法权益的内容
                </List.Item>
                <List.Item>
                  <Text strong>5. 不良信息：</Text>含有法律、行政法规禁止的其他内容；违背社会公德、损害民族优秀文化传统的内容
                </List.Item>
                <List.Item>
                  <Text strong>6. 商业欺诈：</Text>虚假宣传、夸大宣传、误导性宣传；侵犯消费者权益的虚假广告或不实信息
                </List.Item>
              </List>

              <Paragraph style={{ marginTop: 16 }}>
                <Text strong style={{ fontSize: 16 }}>三、用户责任与义务</Text>
              </Paragraph>
              <List size="small" bordered>
                <List.Item>
                  <Text strong>1. 内容审核责任：</Text>用户对使用本系统生成的所有内容承担完全责任，必须在发布前自行审核内容的合法性、真实性和合规性
                </List.Item>
                <List.Item>
                  <Text strong>2. 信息真实性：</Text>用户应确保发布的企业信息、产品信息、服务信息等内容真实、准确、完整，不得进行虚假宣传
                </List.Item>
                <List.Item>
                  <Text strong>3. 知识产权保护：</Text>用户应尊重他人知识产权，不得抄袭、剽窃他人作品，不得侵犯他人著作权、商标权等合法权益
                </List.Item>
                <List.Item>
                  <Text strong>4. 平台规则遵守：</Text>用户在使用本系统向第三方平台发布内容时，必须遵守目标平台的用户协议、社区规范等相关规定
                </List.Item>
                <List.Item>
                  <Text strong>5. 配合监管义务：</Text>用户应配合有关部门的监督检查，如实提供相关信息和资料
                </List.Item>
              </List>

              <Paragraph style={{ marginTop: 16 }}>
                <Text strong style={{ fontSize: 16 }}>四、法律后果与责任承担</Text>
              </Paragraph>
              <Alert
                message="严重警告"
                description={
                  <div>
                    <Paragraph style={{ marginBottom: 8, marginTop: 8 }}>
                      用户违反上述规定，使用本系统发布违法违规内容的，应当依法承担相应的法律责任：
                    </Paragraph>
                    <List size="small">
                      <List.Item>• <Text strong>民事责任：</Text>侵犯他人合法权益的，应当承担停止侵害、消除影响、赔礼道歉、赔偿损失等民事责任</List.Item>
                      <List.Item>• <Text strong>行政责任：</Text>违反相关行政法规的，由有关主管部门责令改正，给予警告、罚款、没收违法所得、责令停业整顿、吊销许可证等行政处罚</List.Item>
                      <List.Item>• <Text strong>刑事责任：</Text>构成犯罪的，依法追究刑事责任，可能面临拘役、有期徒刑等刑事处罚</List.Item>
                    </List>
                  </div>
                }
                type="error"
                showIcon
                style={{ marginTop: 16 }}
              />

              <Paragraph style={{ marginTop: 16 }}>
                <Text strong style={{ fontSize: 16 }}>五、系统提供方的权利与免责</Text>
              </Paragraph>
              <List size="small" bordered>
                <List.Item>
                  <Text strong>1. 工具属性声明：</Text>本系统仅作为内容生成和发布的技术工具，不对用户生成或发布的内容进行事先审查，不承担内容审核义务
                </List.Item>
                <List.Item>
                  <Text strong>2. 用户责任独立：</Text>用户使用本系统生成、编辑、发布的所有内容，其合法性、真实性、准确性、适当性由用户自行负责，与本系统提供方无关
                </List.Item>
                <List.Item>
                  <Text strong>3. 违规处理权利：</Text>本系统提供方有权对违反法律法规或本声明的用户采取警告、限制使用、暂停服务、终止服务等措施
                </List.Item>
                <List.Item>
                  <Text strong>4. 配合执法义务：</Text>本系统提供方将依法配合有关部门的监督检查和调查取证工作，必要时提供用户相关信息
                </List.Item>
                <List.Item>
                  <Text strong>5. 损害赔偿权利：</Text>因用户违法违规使用本系统导致本系统提供方遭受损失的，本系统提供方保留追究用户法律责任和要求赔偿的权利
                </List.Item>
              </List>

              <Paragraph style={{ marginTop: 16 }}>
                <Text strong style={{ fontSize: 16 }}>六、用户确认与承诺</Text>
              </Paragraph>
              <Alert
                message="使用即视为同意"
                description={
                  <div>
                    <Paragraph style={{ marginBottom: 8, marginTop: 8 }}>
                      用户使用本系统即表示已充分阅读、理解并同意遵守本声明的全部内容，并作出以下承诺：
                    </Paragraph>
                    <List size="small">
                      <List.Item>✓ 本人/本单位已充分了解并将严格遵守国家相关法律法规</List.Item>
                      <List.Item>✓ 本人/本单位承诺不使用本系统发布任何违法违规内容</List.Item>
                      <List.Item>✓ 本人/本单位对使用本系统生成和发布的所有内容承担完全责任</List.Item>
                      <List.Item>✓ 本人/本单位理解并接受违规使用可能导致的一切法律后果</List.Item>
                      <List.Item>✓ 本人/本单位同意本系统提供方在必要时向有关部门提供相关信息</List.Item>
                    </List>
                  </div>
                }
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />

              <Divider />

              <Alert
                message="特别提醒"
                description="本声明的解释权归本系统提供方所有。如有疑问，请咨询专业法律人士。本系统提供方保留随时修改本声明的权利，修改后的声明将在系统中公布，用户继续使用本系统即视为接受修改后的声明。"
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />
            </section>

            <Divider />

            {/* 系统简介 */}
            <section id="intro">
              <Title level={3}>
                <InfoCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                系统简介
              </Title>
              <Paragraph>
                GEO优化系统是一个智能化的内容营销平台，帮助企业通过AI技术快速生成高质量的营销文章，
                并自动发布到多个内容平台，提升品牌曝光度和搜索引擎排名。
              </Paragraph>
              <Paragraph>
                <Text strong>主要功能：</Text>
              </Paragraph>
              <List
                size="small"
                dataSource={[
                  '关键词蒸馏：AI分析关键词，生成用户真实搜索的相关话题',
                  '智能文章生成：基于话题自动生成高质量营销文章',
                  '多平台发布：一键发布到头条号、抖音等多个平台',
                  '数据分析：实时查看发布效果和运营数据',
                ]}
                renderItem={(item) => (
                  <List.Item>
                    <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                    {item}
                  </List.Item>
                )}
              />
              <Paragraph style={{ marginTop: 16 }}>
                <Text strong>适用场景：</Text>
              </Paragraph>
              <List
                size="small"
                dataSource={[
                  '企业品牌推广和内容营销',
                  '教育培训机构的课程推广',
                  '电商平台的产品宣传',
                  '本地服务商的业务推广',
                ]}
                renderItem={(item) => (
                  <List.Item>• {item}</List.Item>
                )}
              />
            </section>

            <Divider />

            {/* 快速开始 */}
            <section id="quickstart">
              <Title level={3}>
                <RightOutlined style={{ marginRight: 8, color: '#52c41a' }} />
                快速开始
              </Title>
              <Paragraph>
                按照以下步骤，您可以快速完成从配置到发布的完整流程：
              </Paragraph>
              <Steps
                direction="vertical"
                current={-1}
                items={[
                  {
                    title: '第一步：设置转化目标',
                    description: '在"转化目标"页面添加企业信息，文章生成时会自动引用',
                    icon: <CheckCircleOutlined />,
                  },
                  {
                    title: '第二步：关键词蒸馏',
                    description: '在"关键词蒸馏"页面输入目标关键词，AI会生成相关话题',
                    icon: <CheckCircleOutlined />,
                  },
                  {
                    title: '第三步：生成文章',
                    description: '在"生成文章"页面创建任务，选择话题并生成文章',
                    icon: <CheckCircleOutlined />,
                  },
                  {
                    title: '第四步：配置发布平台',
                    description: '在"平台登录"页面登录目标发布平台（如头条号、抖音）',
                    icon: <CheckCircleOutlined />,
                  },
                  {
                    title: '第五步：创建发布任务',
                    description: '在"发布任务"页面选择文章和平台，创建发布任务',
                    icon: <CheckCircleOutlined />,
                  },
                ]}
              />
              <Alert
                message="提示"
                description="首次使用建议按照上述顺序操作，熟悉后可以根据需要灵活调整流程。"
                type="info"
                showIcon
                style={{ marginTop: 24 }}
              />
            </section>

            <Divider />

            {/* 功能模块 */}
            <section id="modules">
              <Title level={3}>功能模块详细说明</Title>
              
              {/* 3.1 工作台 */}
              <section id="dashboard" style={{ marginTop: 32 }}>
                <Title level={4}>3.1 工作台</Title>
                <Paragraph>
                  <Text strong>功能概述：</Text>工作台是系统的数据中心，展示系统运营数据和提供快速入口。
                </Paragraph>
                <Paragraph>
                  <Text strong>使用说明：</Text>
                </Paragraph>
                <List size="small">
                  <List.Item>• 查看核心指标卡片：蒸馏次数、文章数量、发布任务等</List.Item>
                  <List.Item>• 查看趋势图表：了解系统使用趋势和数据变化</List.Item>
                  <List.Item>• 点击卡片快速跳转：点击任意指标卡片可快速跳转到对应功能页面</List.Item>
                </List>
              </section>

              {/* 3.2 转化目标 */}
              <section id="conversion" style={{ marginTop: 32 }}>
                <Title level={4}>3.2 转化目标</Title>
                <Paragraph>
                  <Text strong>功能概述：</Text>设置企业信息，用于文章生成时自动引用，提升文章的真实性和转化效果。
                </Paragraph>
                <Paragraph>
                  <Text strong>使用步骤：</Text>
                </Paragraph>
                <List size="small" bordered>
                  <List.Item>1. 点击页面右上角的"新建转化目标"按钮</List.Item>
                  <List.Item>2. 在弹出的表单中填写公司名称（必填）</List.Item>
                  <List.Item>3. 填写行业类型、官方网站、公司地址（可选，但建议填写）</List.Item>
                  <List.Item>4. 点击"创建"按钮保存</List.Item>
                </List>
                <Alert
                  message="注意事项"
                  description="转化目标信息会在生成文章时自动引用到文章内容中，建议填写真实准确的企业信息。"
                  type="warning"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              </section>

              {/* 3.3 关键词蒸馏 */}
              <section id="distillation" style={{ marginTop: 32 }}>
                <Title level={4}>3.3 关键词蒸馏</Title>
                <Paragraph>
                  <Text strong>功能概述：</Text>输入目标关键词，AI会分析并生成用户可能搜索的相关话题，为文章创作提供方向。
                </Paragraph>
                <Paragraph>
                  <Text strong>使用步骤：</Text>
                </Paragraph>
                <List size="small" bordered>
                  <List.Item>1. 在输入框中输入您的目标关键词（例如："英国留学"、"Python培训"）</List.Item>
                  <List.Item>2. 点击"开始蒸馏"按钮</List.Item>
                  <List.Item>3. 等待AI生成话题（通常需要10-30秒）</List.Item>
                  <List.Item>4. 系统会自动跳转到蒸馏结果页面展示生成的话题</List.Item>
                </List>
                <Alert
                  message="注意事项"
                  description={
                    <div>
                      <div>• 关键词应该是您的目标业务领域，越具体效果越好</div>
                      <div>• 每次蒸馏会生成10-15个相关话题</div>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              </section>

              {/* 3.4 蒸馏结果 */}
              <section id="results" style={{ marginTop: 32 }}>
                <Title level={4}>3.4 蒸馏结果</Title>
                <Paragraph>
                  <Text strong>功能概述：</Text>查看和管理AI生成的话题，选择合适的话题用于文章生成。
                </Paragraph>
                <Paragraph>
                  <Text strong>使用步骤：</Text>
                </Paragraph>
                <List size="small" bordered>
                  <List.Item>1. 查看生成的话题列表，每个话题代表一个潜在的用户搜索意图</List.Item>
                  <List.Item>2. 勾选您想要生成文章的话题（可多选）</List.Item>
                  <List.Item>3. 点击"生成文章"按钮，跳转到文章生成页面</List.Item>
                </List>
                <Paragraph style={{ marginTop: 16 }}>
                  <Text strong>操作说明：</Text>
                </Paragraph>
                <List size="small">
                  <List.Item>• 可以点击"编辑"按钮修改话题内容</List.Item>
                  <List.Item>• 可以点击"删除"按钮删除不需要的话题</List.Item>
                  <List.Item>• 支持批量选择和批量操作</List.Item>
                </List>
              </section>

              {/* 3.5 企业图库 */}
              <section id="gallery" style={{ marginTop: 32 }}>
                <Title level={4}>3.5 企业图库</Title>
                <Paragraph>
                  <Text strong>功能概述：</Text>管理企业的图片资源，文章生成时可以引用这些图片。
                </Paragraph>
                <Paragraph>
                  <Text strong>使用步骤：</Text>
                </Paragraph>
                <List size="small" bordered>
                  <List.Item>1. 点击"创建相册"按钮</List.Item>
                  <List.Item>2. 输入相册名称（例如："产品图片"、"公司环境"）</List.Item>
                  <List.Item>3. 点击"上传图片"按钮，选择要上传的图片文件</List.Item>
                  <List.Item>4. 上传完成后，图片会显示在相册中</List.Item>
                </List>
                <Paragraph style={{ marginTop: 16 }}>
                  <Text type="secondary">提示：图片可在生成文章时自动插入到文章内容中，提升文章的视觉效果。</Text>
                </Paragraph>
              </section>

              {/* 3.6 企业知识库 */}
              <section id="knowledge" style={{ marginTop: 32 }}>
                <Title level={4}>3.6 企业知识库</Title>
                <Paragraph>
                  <Text strong>功能概述：</Text>管理企业的知识内容，文章生成时AI会参考这些知识。
                </Paragraph>
                <Paragraph>
                  <Text strong>使用步骤：</Text>
                </Paragraph>
                <List size="small" bordered>
                  <List.Item>1. 点击"新建知识库"按钮</List.Item>
                  <List.Item>2. 输入知识库标题（例如："公司简介"、"产品特点"）</List.Item>
                  <List.Item>3. 在内容区域输入详细的知识内容</List.Item>
                  <List.Item>4. 点击"保存"按钮</List.Item>
                </List>
                <Paragraph style={{ marginTop: 16 }}>
                  <Text type="secondary">提示：知识库内容会在生成文章时被AI引用，建议添加企业的核心信息和优势。</Text>
                </Paragraph>
              </section>

              {/* 3.7 文章设置 */}
              <section id="article-settings" style={{ marginTop: 32 }}>
                <Title level={4}>3.7 文章设置</Title>
                <Paragraph>
                  <Text strong>功能概述：</Text>配置文章生成的参数，控制文章的风格和质量。
                </Paragraph>
                <Paragraph>
                  <Text strong>使用步骤：</Text>
                </Paragraph>
                <List size="small" bordered>
                  <List.Item>1. 编辑文章生成提示词，指导AI如何生成文章</List.Item>
                  <List.Item>2. 配置文章长度、风格等参数</List.Item>
                  <List.Item>3. 点击"保存配置"按钮</List.Item>
                </List>
                <Paragraph style={{ marginTop: 16 }}>
                  <Text type="secondary">提示：修改配置后，新的文章生成任务会使用新的配置。</Text>
                </Paragraph>
              </section>

              {/* 3.8 生成文章 */}
              <section id="generation" style={{ marginTop: 32 }}>
                <Title level={4}>3.8 生成文章</Title>
                <Paragraph>
                  <Text strong>功能概述：</Text>创建文章生成任务，AI会根据选择的话题自动生成文章。
                </Paragraph>
                <Paragraph>
                  <Text strong>使用步骤：</Text>
                </Paragraph>
                <List size="small" bordered>
                  <List.Item>1. 点击"新建任务"按钮</List.Item>
                  <List.Item>2. 选择转化目标（可选，选择后文章会引用企业信息）</List.Item>
                  <List.Item>3. 选择关键词（从已蒸馏的关键词中选择）</List.Item>
                  <List.Item>4. 选择蒸馏结果（选择要生成文章的话题）</List.Item>
                  <List.Item>5. 设置生成数量（每个话题生成几篇文章）</List.Item>
                  <List.Item>6. 点击"创建任务"按钮</List.Item>
                  <List.Item>7. 等待任务执行完成，可在任务列表中查看进度</List.Item>
                </List>
                <Alert
                  message="注意事项"
                  description={
                    <div>
                      <div>• 任务创建后会自动执行，无需手动触发</div>
                      <div>• 可以在任务列表中查看任务进度和生成的文章数量</div>
                      <div>• 生成的文章会自动保存到"文章管理"页面</div>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              </section>

              {/* 3.9 文章管理 */}
              <section id="articles" style={{ marginTop: 32 }}>
                <Title level={4}>3.9 文章管理</Title>
                <Paragraph>
                  <Text strong>功能概述：</Text>查看、编辑和管理所有生成的文章。
                </Paragraph>
                <Paragraph>
                  <Text strong>使用步骤：</Text>
                </Paragraph>
                <List size="small" bordered>
                  <List.Item>1. 在列表中查看所有文章，包括标题、关键词、创建时间等信息</List.Item>
                  <List.Item>2. 点击"预览"按钮查看文章的完整内容</List.Item>
                  <List.Item>3. 点击"编辑"按钮修改文章内容</List.Item>
                  <List.Item>4. 点击"删除"按钮删除不需要的文章</List.Item>
                </List>
                <Paragraph style={{ marginTop: 16 }}>
                  <Text strong>筛选功能：</Text>
                </Paragraph>
                <List size="small">
                  <List.Item>• 按关键词筛选：查看特定关键词的文章</List.Item>
                  <List.Item>• 按发布状态筛选：查看已发布或未发布的文章</List.Item>
                  <List.Item>• 搜索功能：搜索文章标题或内容</List.Item>
                </List>
              </section>

              {/* 3.10 平台登录 */}
              <section id="platform" style={{ marginTop: 32 }}>
                <Title level={4}>3.10 平台登录</Title>
                <Paragraph>
                  <Text strong>功能概述：</Text>配置发布平台账号，登录后可以发布文章到对应平台。
                </Paragraph>
                <Paragraph>
                  <Text strong>使用步骤：</Text>
                </Paragraph>
                <List size="small" bordered>
                  <List.Item>1. 在平台卡片区域找到您要登录的平台（例如"头条号"、"抖音"）</List.Item>
                  <List.Item>2. 点击平台卡片</List.Item>
                  <List.Item>3. 系统会自动打开浏览器，跳转到平台的登录页面</List.Item>
                  <List.Item>4. 在浏览器中完成登录操作（输入账号密码、扫码等）</List.Item>
                  <List.Item>5. 登录成功后，Cookie会自动保存到系统中</List.Item>
                  <List.Item>6. 返回系统，平台卡片会显示"已登录"状态</List.Item>
                </List>
                <Alert
                  message="注意事项"
                  description={
                    <div>
                      <div>• 需要有对应平台的账号才能登录</div>
                      <div>• 登录信息会自动保存，下次使用无需重复登录</div>
                      <div>• 支持同时登录多个平台</div>
                      <div>• 如果登录失效，重新点击平台卡片即可重新登录</div>
                    </div>
                  }
                  type="warning"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              </section>

              {/* 3.11 发布任务 */}
              <section id="tasks" style={{ marginTop: 32 }}>
                <Title level={4}>3.11 发布任务</Title>
                <Paragraph>
                  <Text strong>功能概述：</Text>创建文章发布任务，自动将文章发布到已登录的平台。
                </Paragraph>
                <Paragraph>
                  <Text strong>使用步骤：</Text>
                </Paragraph>
                <List size="small" bordered>
                  <List.Item>1. 在"选择文章"区域勾选要发布的文章（可多选）</List.Item>
                  <List.Item>2. 在"选择发布平台"区域勾选目标平台（可多选）</List.Item>
                  <List.Item>3. 设置发布间隔（单位：分钟，建议5分钟以上）</List.Item>
                  <List.Item>4. 选择是否开启静默发布模式（开启后浏览器在后台运行）</List.Item>
                  <List.Item>5. 点击"创建发布任务"按钮</List.Item>
                  <List.Item>6. 在确认对话框中查看任务信息，点击"确定"</List.Item>
                </List>
                <Paragraph style={{ marginTop: 16 }}>
                  <Text strong>任务管理：</Text>
                </Paragraph>
                <List size="small">
                  <List.Item>• 查看任务状态：等待中、执行中、成功、失败</List.Item>
                  <List.Item>• 点击"日志"按钮查看任务执行的详细日志</List.Item>
                  <List.Item>• 点击"执行"按钮立即执行等待中的任务</List.Item>
                  <List.Item>• 点击"终止"按钮停止正在执行的任务</List.Item>
                  <List.Item>• 点击"删除"按钮删除已完成的任务</List.Item>
                </List>
                <Alert
                  message="注意事项"
                  description={
                    <div>
                      <div>• 使用前需先在"平台登录"页面登录对应平台</div>
                      <div>• 发布间隔建议设置5分钟以上，避免被平台限制</div>
                      <div>• 静默模式下浏览器在后台运行，不会弹出窗口</div>
                      <div>• 系统采用串行发布，任务会按照设置的间隔依次执行</div>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              </section>

              {/* 3.12 发布记录 */}
              <section id="records" style={{ marginTop: 32 }}>
                <Title level={4}>3.12 发布记录</Title>
                <Paragraph>
                  <Text strong>功能概述：</Text>查看历史发布记录，了解文章的发布情况。
                </Paragraph>
                <Paragraph>
                  <Text strong>使用说明：</Text>
                </Paragraph>
                <List size="small">
                  <List.Item>• 查看所有发布任务的历史记录</List.Item>
                  <List.Item>• 筛选成功或失败的记录</List.Item>
                  <List.Item>• 查看发布时间、平台信息、文章标题等详细信息</List.Item>
                  <List.Item>• 可以根据时间范围筛选记录</List.Item>
                </List>
              </section>
            </section>

            <Divider />

            {/* 常见问题 */}
            <section id="faq">
              <Title level={3}>
                <QuestionCircleOutlined style={{ marginRight: 8, color: '#faad14' }} />
                常见问题
              </Title>
              <Collapse
                accordion
                items={[
                  {
                    key: '1',
                    label: 'Q1: 如何开始使用系统？',
                    children: (
                      <div>
                        <Paragraph><Text strong>A:</Text></Paragraph>
                        <List size="small" bordered>
                          <List.Item>1. 首先在"转化目标"页面添加您的企业信息</List.Item>
                          <List.Item>2. 然后在"关键词蒸馏"页面输入目标关键词</List.Item>
                          <List.Item>3. 选择生成的话题，创建文章生成任务</List.Item>
                          <List.Item>4. 在"平台登录"页面登录发布平台</List.Item>
                          <List.Item>5. 最后创建发布任务，将文章发布到平台</List.Item>
                        </List>
                      </div>
                    ),
                  },
                  {
                    key: '2',
                    label: 'Q2: 关键词蒸馏失败怎么办？',
                    children: (
                      <div>
                        <Paragraph><Text strong>A:</Text> 请按以下步骤排查：</Paragraph>
                        <List size="small" bordered>
                          <List.Item>1. 检查网络连接是否正常</List.Item>
                          <List.Item>2. 查看页面上的错误提示信息，了解具体原因</List.Item>
                          <List.Item>3. 如果问题持续，请联系系统管理员</List.Item>
                        </List>
                      </div>
                    ),
                  },
                  {
                    key: '3',
                    label: 'Q3: 文章生成失败怎么办？',
                    children: (
                      <div>
                        <Paragraph><Text strong>A:</Text> 请按以下步骤排查：</Paragraph>
                        <List size="small" bordered>
                          <List.Item>1. 检查是否选择了蒸馏结果（话题）</List.Item>
                          <List.Item>2. 在"生成文章"页面查看任务状态</List.Item>
                          <List.Item>3. 点击任务的"日志"按钮查看详细错误信息</List.Item>
                          <List.Item>4. 如果问题持续，请联系系统管理员</List.Item>
                        </List>
                      </div>
                    ),
                  },
                  {
                    key: '4',
                    label: 'Q4: 平台登录失败怎么办？',
                    children: (
                      <div>
                        <Paragraph><Text strong>A:</Text> 请按以下步骤排查：</Paragraph>
                        <List size="small" bordered>
                          <List.Item>1. 确保您的电脑已安装浏览器（Chrome、Edge等）</List.Item>
                          <List.Item>2. 检查网络连接是否正常</List.Item>
                          <List.Item>3. 尝试手动在浏览器中登录平台，确认账号密码正确</List.Item>
                          <List.Item>4. 查看系统日志了解详细错误信息</List.Item>
                          <List.Item>5. 如果浏览器没有自动打开，请检查浏览器是否被安全软件拦截</List.Item>
                        </List>
                      </div>
                    ),
                  },
                  {
                    key: '5',
                    label: 'Q5: 发布任务一直等待中？',
                    children: (
                      <div>
                        <Paragraph><Text strong>A:</Text> 这是正常现象，原因如下：</Paragraph>
                        <List size="small" bordered>
                          <List.Item>1. 系统采用串行发布机制，任务会按顺序依次执行</List.Item>
                          <List.Item>2. 如果前面有任务正在执行，后面的任务需要等待</List.Item>
                          <List.Item>3. 发布间隔时间也会影响任务执行速度</List.Item>
                          <List.Item>4. 如果需要立即执行，可以点击任务的"执行"按钮</List.Item>
                          <List.Item>5. 可以在任务列表中查看当前正在执行的任务</List.Item>
                        </List>
                      </div>
                    ),
                  },
                  {
                    key: '6',
                    label: 'Q6: 如何批量发布文章？',
                    children: (
                      <div>
                        <Paragraph><Text strong>A:</Text> 批量发布步骤：</Paragraph>
                        <List size="small" bordered>
                          <List.Item>1. 在"发布任务"页面的"选择文章"区域勾选多篇文章</List.Item>
                          <List.Item>2. 在"选择发布平台"区域勾选多个平台</List.Item>
                          <List.Item>3. 设置合适的发布间隔（建议5-10分钟）</List.Item>
                          <List.Item>4. 点击"创建发布任务"按钮</List.Item>
                          <List.Item>5. 系统会自动创建多个任务（文章数 × 平台数）</List.Item>
                          <List.Item>6. 任务会按照设置的间隔依次执行</List.Item>
                        </List>
                        <Alert
                          message="提示"
                          description="批量发布时，建议设置较长的发布间隔，避免被平台识别为异常操作。"
                          type="info"
                          showIcon
                          style={{ marginTop: 16 }}
                        />
                      </div>
                    ),
                  },
                ]}
              />
            </section>
          </div>
        </div>
      </Card>

      {/* 添加搜索高亮样式 */}
      <style>{`
        .search-highlight {
          background-color: #fff566;
          padding: 2px 0;
        }
        .search-highlight.current-match {
          background-color: #ffa940;
          font-weight: bold;
        }
        @media print {
          .manual-toc,
          .ant-btn,
          .ant-input-search {
            display: none !important;
          }
          .manual-content {
            width: 100% !important;
          }
        }
        @media (max-width: 768px) {
          .manual-toc {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
