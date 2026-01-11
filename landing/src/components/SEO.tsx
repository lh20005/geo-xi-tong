import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  noIndex?: boolean;
}

const BASE_URL = 'https://jzgeo.cc';
const DEFAULT_IMAGE = `${BASE_URL}/images/og-image.svg`;

export default function SEO({
  title = 'GEO优化系统 - AI时代品牌推荐优化工具',
  description = 'GEO优化系统是基于普林斯顿大学GEO研究方法论的SaaS工具，帮助品牌提升在ChatGPT、Claude、Gemini等AI平台的推荐率。',
  keywords = 'GEO优化,生成式引擎优化,AI推荐优化,ChatGPT优化,品牌AI曝光',
  canonicalUrl,
  ogImage = DEFAULT_IMAGE,
  ogType = 'website',
  noIndex = false,
}: SEOProps) {
  const fullTitle = title.includes('GEO优化系统') ? title : `${title} | GEO优化系统`;
  const canonical = canonicalUrl || (typeof window !== 'undefined' ? window.location.href : BASE_URL);

  return (
    <Helmet>
      {/* 基础 Meta */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      
      {/* 索引控制 */}
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large" />
      )}
      
      {/* 规范链接 */}
      <link rel="canonical" href={canonical} />
      
      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={canonical} />
      <meta property="og:site_name" content="GEO优化系统" />
      <meta property="og:locale" content="zh_CN" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
}
