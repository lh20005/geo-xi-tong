--
-- PostgreSQL database dump
--

\restrict tU2i0IcpSmFh9YShh802PgUohbEJk2lREO1s8E3LV3x3EMoAr2Acje1ccC188K1

-- Dumped from database version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- ==================== MIGRATION NOTES ====================
-- This schema has been processed for Windows client migration
-- 
-- REMOVED FOREIGN KEYS (cross-database references):
--   - user_id foreign keys (13 constraints) - users table stays on server
--   - task_id foreign keys (3 constraints) - generation_tasks table stays on server
--
-- PRESERVED FOREIGN KEYS (same-database references):
--   - All table-to-table foreign keys within migrated tables
--   - Examples: articles -> topics, images -> albums, etc.
--
-- DATA INTEGRITY:
--   - user_id: Will be obtained from JWT token (server-signed, secure)
--   - task_id: Will be set to NULL during migration
--   - Application layer will enforce data integrity
-- ==========================================================



SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: albums; Type: TABLE; Schema: public; Owner: geo_user
--

CREATE TABLE public.albums (
    id integer NOT NULL,
    user_id integer,
    name character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.albums OWNER TO geo_user;

--
-- Name: albums_id_seq; Type: SEQUENCE; Schema: public; Owner: geo_user
--

CREATE SEQUENCE public.albums_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.albums_id_seq OWNER TO geo_user;

--
-- Name: albums_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: geo_user
--

ALTER SEQUENCE public.albums_id_seq OWNED BY public.albums.id;


--
-- Name: article_settings; Type: TABLE; Schema: public; Owner: geo_user
--

CREATE TABLE public.article_settings (
    id integer NOT NULL,
    user_id integer,
    name character varying(255) NOT NULL,
    prompt text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.article_settings OWNER TO geo_user;

--
-- Name: article_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: geo_user
--

CREATE SEQUENCE public.article_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.article_settings_id_seq OWNER TO geo_user;

--
-- Name: article_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: geo_user
--

ALTER SEQUENCE public.article_settings_id_seq OWNED BY public.article_settings.id;


--
-- Name: articles; Type: TABLE; Schema: public; Owner: geo_user
--

CREATE TABLE public.articles (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title character varying(500),
    keyword character varying(255) NOT NULL,
    distillation_id integer,
    topic_id integer,
    task_id integer,
    image_id integer,
    requirements text,
    content text NOT NULL,
    image_url character varying(500),
    image_size_bytes integer DEFAULT 0,
    provider character varying(20) NOT NULL,
    is_published boolean DEFAULT false,
    publishing_status character varying(20),
    published_at timestamp without time zone,
    distillation_keyword_snapshot character varying(255),
    topic_question_snapshot text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.articles OWNER TO geo_user;

--
-- Name: COLUMN articles.image_id; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.articles.image_id IS '引用的图片ID，用于引用计数管理';


--
-- Name: COLUMN articles.image_size_bytes; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.articles.image_size_bytes IS '文章引用图片的大小（字节），用于存储配额计算';


--
-- Name: COLUMN articles.publishing_status; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.articles.publishing_status IS '发布状态: unpublished(未发布), publishing(发布中), published(已发布), failed(发布失败)';


--
-- Name: COLUMN articles.distillation_keyword_snapshot; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.articles.distillation_keyword_snapshot IS '蒸馏关键词快照（删除源数据后仍保留）';


--
-- Name: COLUMN articles.topic_question_snapshot; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.articles.topic_question_snapshot IS '话题问题快照（删除源数据后仍保留）';


--
-- Name: articles_id_seq; Type: SEQUENCE; Schema: public; Owner: geo_user
--

CREATE SEQUENCE public.articles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.articles_id_seq OWNER TO geo_user;

--
-- Name: articles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: geo_user
--

ALTER SEQUENCE public.articles_id_seq OWNED BY public.articles.id;


--
-- Name: conversion_targets; Type: TABLE; Schema: public; Owner: geo_user
--

CREATE TABLE public.conversion_targets (
    id integer NOT NULL,
    user_id integer,
    company_name character varying(255) NOT NULL,
    industry character varying(100),
    company_size character varying(50),
    features text,
    contact_info character varying(255),
    website character varying(500),
    target_audience text,
    core_products text,
    address character varying(500),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.conversion_targets OWNER TO geo_user;

--
-- Name: COLUMN conversion_targets.industry; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.conversion_targets.industry IS '行业（可选）';


--
-- Name: COLUMN conversion_targets.company_size; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.conversion_targets.company_size IS '公司规模（可选）';


--
-- Name: COLUMN conversion_targets.features; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.conversion_targets.features IS '公司特点（可选）';


--
-- Name: COLUMN conversion_targets.contact_info; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.conversion_targets.contact_info IS '联系方式（可选）';


--
-- Name: COLUMN conversion_targets.target_audience; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.conversion_targets.target_audience IS '目标受众（可选）';


--
-- Name: COLUMN conversion_targets.core_products; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.conversion_targets.core_products IS '核心产品（可选）';


--
-- Name: COLUMN conversion_targets.address; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.conversion_targets.address IS '公司地址';


--
-- Name: conversion_targets_id_seq; Type: SEQUENCE; Schema: public; Owner: geo_user
--

CREATE SEQUENCE public.conversion_targets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversion_targets_id_seq OWNER TO geo_user;

--
-- Name: conversion_targets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: geo_user
--

ALTER SEQUENCE public.conversion_targets_id_seq OWNED BY public.conversion_targets.id;


--
-- Name: distillation_config; Type: TABLE; Schema: public; Owner: geo_user
--

CREATE TABLE public.distillation_config (
    id integer NOT NULL,
    user_id integer,
    prompt text NOT NULL,
    topic_count integer DEFAULT 12 NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT distillation_config_topic_count_check CHECK (((topic_count >= 5) AND (topic_count <= 30)))
);


ALTER TABLE public.distillation_config OWNER TO geo_user;

--
-- Name: distillation_config_id_seq; Type: SEQUENCE; Schema: public; Owner: geo_user
--

CREATE SEQUENCE public.distillation_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.distillation_config_id_seq OWNER TO geo_user;

--
-- Name: distillation_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: geo_user
--

ALTER SEQUENCE public.distillation_config_id_seq OWNED BY public.distillation_config.id;


--
-- Name: distillation_usage; Type: TABLE; Schema: public; Owner: geo_user
--

CREATE TABLE public.distillation_usage (
    id integer NOT NULL,
    distillation_id integer,
    task_id integer NOT NULL,
    article_id integer,
    used_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.distillation_usage OWNER TO geo_user;

--
-- Name: distillation_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: geo_user
--

CREATE SEQUENCE public.distillation_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.distillation_usage_id_seq OWNER TO geo_user;

--
-- Name: distillation_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: geo_user
--

ALTER SEQUENCE public.distillation_usage_id_seq OWNED BY public.distillation_usage.id;


--
-- Name: distillations; Type: TABLE; Schema: public; Owner: geo_user
--

CREATE TABLE public.distillations (
    id integer NOT NULL,
    user_id integer,
    keyword character varying(255) NOT NULL,
    provider character varying(20) NOT NULL,
    usage_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.distillations OWNER TO geo_user;

--
-- Name: COLUMN distillations.usage_count; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.distillations.usage_count IS '使用次数统计';


--
-- Name: distillations_id_seq; Type: SEQUENCE; Schema: public; Owner: geo_user
--

CREATE SEQUENCE public.distillations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.distillations_id_seq OWNER TO geo_user;

--
-- Name: distillations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: geo_user
--

ALTER SEQUENCE public.distillations_id_seq OWNED BY public.distillations.id;


--
-- Name: image_usage; Type: TABLE; Schema: public; Owner: geo_user
--

CREATE TABLE public.image_usage (
    id integer NOT NULL,
    image_id integer NOT NULL,
    article_id integer NOT NULL,
    used_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.image_usage OWNER TO geo_user;

--
-- Name: image_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: geo_user
--

CREATE SEQUENCE public.image_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.image_usage_id_seq OWNER TO geo_user;

--
-- Name: image_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: geo_user
--

ALTER SEQUENCE public.image_usage_id_seq OWNED BY public.image_usage.id;


--
-- Name: images; Type: TABLE; Schema: public; Owner: geo_user
--

CREATE TABLE public.images (
    id integer NOT NULL,
    user_id integer,
    album_id integer,
    filename character varying(255) NOT NULL,
    filepath character varying(500) NOT NULL,
    mime_type character varying(50) NOT NULL,
    size integer NOT NULL,
    usage_count integer DEFAULT 0,
    deleted_at timestamp without time zone,
    is_orphan boolean DEFAULT false,
    reference_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.images OWNER TO geo_user;

--
-- Name: COLUMN images.user_id; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.images.user_id IS '图片所属用户ID，用于存储计算（即使相册被删除也能关联用户）';


--
-- Name: COLUMN images.deleted_at; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.images.deleted_at IS '软删除时间，NULL表示未删除';


--
-- Name: COLUMN images.is_orphan; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.images.is_orphan IS '是否为孤儿文件（图库删除但被文章引用）';


--
-- Name: COLUMN images.reference_count; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.images.reference_count IS '被文章引用的次数，用于存储配额计算';


--
-- Name: images_id_seq; Type: SEQUENCE; Schema: public; Owner: geo_user
--

CREATE SEQUENCE public.images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.images_id_seq OWNER TO geo_user;

--
-- Name: images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: geo_user
--

ALTER SEQUENCE public.images_id_seq OWNED BY public.images.id;


--
-- Name: knowledge_bases; Type: TABLE; Schema: public; Owner: geo_user
--

CREATE TABLE public.knowledge_bases (
    id integer NOT NULL,
    user_id integer,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.knowledge_bases OWNER TO geo_user;

--
-- Name: knowledge_bases_id_seq; Type: SEQUENCE; Schema: public; Owner: geo_user
--

CREATE SEQUENCE public.knowledge_bases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.knowledge_bases_id_seq OWNER TO geo_user;

--
-- Name: knowledge_bases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: geo_user
--

ALTER SEQUENCE public.knowledge_bases_id_seq OWNED BY public.knowledge_bases.id;


--
-- Name: knowledge_documents; Type: TABLE; Schema: public; Owner: geo_user
--

CREATE TABLE public.knowledge_documents (
    id integer NOT NULL,
    knowledge_base_id integer NOT NULL,
    filename character varying(255) NOT NULL,
    file_type character varying(50) NOT NULL,
    file_size integer NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.knowledge_documents OWNER TO geo_user;

--
-- Name: knowledge_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: geo_user
--

CREATE SEQUENCE public.knowledge_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.knowledge_documents_id_seq OWNER TO geo_user;

--
-- Name: knowledge_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: geo_user
--

ALTER SEQUENCE public.knowledge_documents_id_seq OWNED BY public.knowledge_documents.id;


--
-- Name: platform_accounts; Type: TABLE; Schema: public; Owner: geo_user
--

CREATE TABLE public.platform_accounts (
    id integer NOT NULL,
    user_id integer NOT NULL,
    platform character varying(50) NOT NULL,
    platform_id character varying(50),
    account_name character varying(100),
    real_username character varying(255),
    credentials text,
    cookies text,
    status character varying(20) DEFAULT 'inactive'::character varying,
    is_default boolean DEFAULT false,
    error_message text,
    last_used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.platform_accounts OWNER TO geo_user;

--
-- Name: COLUMN platform_accounts.real_username; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.platform_accounts.real_username IS '平台上的真实用户名（用于区分同一平台的多个账号）';


--
-- Name: platform_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: geo_user
--

CREATE SEQUENCE public.platform_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.platform_accounts_id_seq OWNER TO geo_user;

--
-- Name: platform_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: geo_user
--

ALTER SEQUENCE public.platform_accounts_id_seq OWNED BY public.platform_accounts.id;


--
-- Name: publishing_logs; Type: TABLE; Schema: public; Owner: geo_user
--

CREATE TABLE public.publishing_logs (
    id integer NOT NULL,
    task_id integer NOT NULL,
    level character varying(20) NOT NULL,
    message text NOT NULL,
    details text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.publishing_logs OWNER TO geo_user;

--
-- Name: publishing_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: geo_user
--

CREATE SEQUENCE public.publishing_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.publishing_logs_id_seq OWNER TO geo_user;

--
-- Name: publishing_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: geo_user
--

ALTER SEQUENCE public.publishing_logs_id_seq OWNED BY public.publishing_logs.id;


--
-- Name: publishing_records; Type: TABLE; Schema: public; Owner: geo_user
--

CREATE TABLE public.publishing_records (
    id integer NOT NULL,
    user_id integer NOT NULL,
    article_id integer,
    task_id integer,
    account_id integer NOT NULL,
    account_name character varying(100),
    platform_id character varying(50) NOT NULL,
    platform_article_id character varying(255),
    platform_url character varying(500),
    status character varying(20) DEFAULT 'pending'::character varying,
    publishing_status character varying(20) DEFAULT 'draft'::character varying,
    published_at timestamp without time zone,
    error_message text,
    article_title character varying(500),
    article_content text,
    article_keyword character varying(255),
    article_image_url text,
    topic_question text,
    article_setting_name character varying(255),
    distillation_keyword character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    real_username_snapshot character varying(255)
);


ALTER TABLE public.publishing_records OWNER TO geo_user;

--
-- Name: COLUMN publishing_records.article_title; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.publishing_records.article_title IS '文章标题快照';


--
-- Name: COLUMN publishing_records.article_content; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.publishing_records.article_content IS '文章内容快照';


--
-- Name: COLUMN publishing_records.article_keyword; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.publishing_records.article_keyword IS '文章关键词快照';


--
-- Name: COLUMN publishing_records.article_image_url; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.publishing_records.article_image_url IS '文章图片URL快照';


--
-- Name: COLUMN publishing_records.topic_question; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.publishing_records.topic_question IS '蒸馏话题问题快照';


--
-- Name: COLUMN publishing_records.article_setting_name; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.publishing_records.article_setting_name IS '文章设置名称快照';


--
-- Name: COLUMN publishing_records.distillation_keyword; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.publishing_records.distillation_keyword IS '蒸馏关键词快照';


--
-- Name: COLUMN publishing_records.real_username_snapshot; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.publishing_records.real_username_snapshot IS '真实用户名快照（删除账号后仍保留）';


--
-- Name: publishing_records_id_seq; Type: SEQUENCE; Schema: public; Owner: geo_user
--

CREATE SEQUENCE public.publishing_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.publishing_records_id_seq OWNER TO geo_user;

--
-- Name: publishing_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: geo_user
--

ALTER SEQUENCE public.publishing_records_id_seq OWNED BY public.publishing_records.id;


--
-- Name: publishing_tasks; Type: TABLE; Schema: public; Owner: geo_user
--

CREATE TABLE public.publishing_tasks (
    id integer NOT NULL,
    user_id integer NOT NULL,
    article_id integer,
    account_id integer NOT NULL,
    platform_id character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    config text NOT NULL,
    scheduled_at timestamp without time zone,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    error_message text,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 3,
    batch_id character varying(50),
    batch_order integer DEFAULT 0,
    interval_minutes integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    article_title text,
    article_content text,
    article_keyword character varying(255),
    article_image_url text,
    account_name_snapshot character varying(255),
    real_username_snapshot character varying(255)
);


ALTER TABLE public.publishing_tasks OWNER TO geo_user;

--
-- Name: COLUMN publishing_tasks.account_name_snapshot; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.publishing_tasks.account_name_snapshot IS '账号名称快照（删除账号后仍保留）';


--
-- Name: COLUMN publishing_tasks.real_username_snapshot; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.publishing_tasks.real_username_snapshot IS '真实用户名快照（删除账号后仍保留）';


--
-- Name: publishing_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: geo_user
--

CREATE SEQUENCE public.publishing_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.publishing_tasks_id_seq OWNER TO geo_user;

--
-- Name: publishing_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: geo_user
--

ALTER SEQUENCE public.publishing_tasks_id_seq OWNED BY public.publishing_tasks.id;


--
-- Name: topic_usage; Type: TABLE; Schema: public; Owner: geo_user
--

CREATE TABLE public.topic_usage (
    id integer NOT NULL,
    topic_id integer,
    distillation_id integer,
    article_id integer,
    task_id integer,
    keyword character varying(255),
    used_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.topic_usage OWNER TO geo_user;

--
-- Name: COLUMN topic_usage.keyword; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.topic_usage.keyword IS '关键词（独立存储）';


--
-- Name: topic_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: geo_user
--

CREATE SEQUENCE public.topic_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.topic_usage_id_seq OWNER TO geo_user;

--
-- Name: topic_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: geo_user
--

ALTER SEQUENCE public.topic_usage_id_seq OWNED BY public.topic_usage.id;


--
-- Name: topics; Type: TABLE; Schema: public; Owner: geo_user
--

CREATE TABLE public.topics (
    id integer NOT NULL,
    user_id integer NOT NULL,
    distillation_id integer,
    keyword character varying(255) NOT NULL,
    question text NOT NULL,
    usage_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.topics OWNER TO geo_user;

--
-- Name: COLUMN topics.user_id; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.topics.user_id IS '用户ID（独立存储，用于多租户隔离）';


--
-- Name: COLUMN topics.distillation_id; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.topics.distillation_id IS '来源蒸馏ID（可选，仅作追踪用途，ON DELETE SET NULL）';


--
-- Name: COLUMN topics.keyword; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON COLUMN public.topics.keyword IS '关键词（独立存储，不依赖 distillations）';


--
-- Name: topics_id_seq; Type: SEQUENCE; Schema: public; Owner: geo_user
--

CREATE SEQUENCE public.topics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.topics_id_seq OWNER TO geo_user;

--
-- Name: topics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: geo_user
--

ALTER SEQUENCE public.topics_id_seq OWNED BY public.topics.id;


--
-- Name: albums id; Type: DEFAULT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.albums ALTER COLUMN id SET DEFAULT nextval('public.albums_id_seq'::regclass);


--
-- Name: article_settings id; Type: DEFAULT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.article_settings ALTER COLUMN id SET DEFAULT nextval('public.article_settings_id_seq'::regclass);


--
-- Name: articles id; Type: DEFAULT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.articles ALTER COLUMN id SET DEFAULT nextval('public.articles_id_seq'::regclass);


--
-- Name: conversion_targets id; Type: DEFAULT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.conversion_targets ALTER COLUMN id SET DEFAULT nextval('public.conversion_targets_id_seq'::regclass);


--
-- Name: distillation_config id; Type: DEFAULT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.distillation_config ALTER COLUMN id SET DEFAULT nextval('public.distillation_config_id_seq'::regclass);


--
-- Name: distillation_usage id; Type: DEFAULT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.distillation_usage ALTER COLUMN id SET DEFAULT nextval('public.distillation_usage_id_seq'::regclass);


--
-- Name: distillations id; Type: DEFAULT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.distillations ALTER COLUMN id SET DEFAULT nextval('public.distillations_id_seq'::regclass);


--
-- Name: image_usage id; Type: DEFAULT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.image_usage ALTER COLUMN id SET DEFAULT nextval('public.image_usage_id_seq'::regclass);


--
-- Name: images id; Type: DEFAULT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.images ALTER COLUMN id SET DEFAULT nextval('public.images_id_seq'::regclass);


--
-- Name: knowledge_bases id; Type: DEFAULT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.knowledge_bases ALTER COLUMN id SET DEFAULT nextval('public.knowledge_bases_id_seq'::regclass);


--
-- Name: knowledge_documents id; Type: DEFAULT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.knowledge_documents ALTER COLUMN id SET DEFAULT nextval('public.knowledge_documents_id_seq'::regclass);


--
-- Name: platform_accounts id; Type: DEFAULT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.platform_accounts ALTER COLUMN id SET DEFAULT nextval('public.platform_accounts_id_seq'::regclass);


--
-- Name: publishing_logs id; Type: DEFAULT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.publishing_logs ALTER COLUMN id SET DEFAULT nextval('public.publishing_logs_id_seq'::regclass);


--
-- Name: publishing_records id; Type: DEFAULT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.publishing_records ALTER COLUMN id SET DEFAULT nextval('public.publishing_records_id_seq'::regclass);


--
-- Name: publishing_tasks id; Type: DEFAULT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.publishing_tasks ALTER COLUMN id SET DEFAULT nextval('public.publishing_tasks_id_seq'::regclass);


--
-- Name: topic_usage id; Type: DEFAULT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.topic_usage ALTER COLUMN id SET DEFAULT nextval('public.topic_usage_id_seq'::regclass);


--
-- Name: topics id; Type: DEFAULT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.topics ALTER COLUMN id SET DEFAULT nextval('public.topics_id_seq'::regclass);


--
-- Name: albums albums_pkey; Type: CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.albums
    ADD CONSTRAINT albums_pkey PRIMARY KEY (id);


--
-- Name: article_settings article_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.article_settings
    ADD CONSTRAINT article_settings_pkey PRIMARY KEY (id);


--
-- Name: articles articles_pkey; Type: CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_pkey PRIMARY KEY (id);


--
-- Name: conversion_targets conversion_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.conversion_targets
    ADD CONSTRAINT conversion_targets_pkey PRIMARY KEY (id);


--
-- Name: distillation_config distillation_config_pkey; Type: CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.distillation_config
    ADD CONSTRAINT distillation_config_pkey PRIMARY KEY (id);


--
-- Name: distillation_usage distillation_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.distillation_usage
    ADD CONSTRAINT distillation_usage_pkey PRIMARY KEY (id);


--
-- Name: distillations distillations_pkey; Type: CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.distillations
    ADD CONSTRAINT distillations_pkey PRIMARY KEY (id);


--
-- Name: image_usage image_usage_image_id_article_id_key; Type: CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.image_usage
    ADD CONSTRAINT image_usage_image_id_article_id_key UNIQUE (image_id, article_id);


--
-- Name: image_usage image_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.image_usage
    ADD CONSTRAINT image_usage_pkey PRIMARY KEY (id);


--
-- Name: images images_pkey; Type: CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_pkey PRIMARY KEY (id);


--
-- Name: knowledge_bases knowledge_bases_pkey; Type: CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.knowledge_bases
    ADD CONSTRAINT knowledge_bases_pkey PRIMARY KEY (id);


--
-- Name: knowledge_documents knowledge_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_pkey PRIMARY KEY (id);


--
-- Name: platform_accounts platform_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.platform_accounts
    ADD CONSTRAINT platform_accounts_pkey PRIMARY KEY (id);


--
-- Name: publishing_logs publishing_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.publishing_logs
    ADD CONSTRAINT publishing_logs_pkey PRIMARY KEY (id);


--
-- Name: publishing_records publishing_records_pkey; Type: CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.publishing_records
    ADD CONSTRAINT publishing_records_pkey PRIMARY KEY (id);


--
-- Name: publishing_tasks publishing_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.publishing_tasks
    ADD CONSTRAINT publishing_tasks_pkey PRIMARY KEY (id);


--
-- Name: topic_usage topic_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.topic_usage
    ADD CONSTRAINT topic_usage_pkey PRIMARY KEY (id);


--
-- Name: topics topics_pkey; Type: CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_pkey PRIMARY KEY (id);


--
-- Name: idx_albums_created_at; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_albums_created_at ON public.albums USING btree (created_at DESC);


--
-- Name: idx_albums_user_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_albums_user_id ON public.albums USING btree (user_id);


--
-- Name: idx_article_settings_created_at; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_article_settings_created_at ON public.article_settings USING btree (created_at DESC);


--
-- Name: idx_article_settings_user_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_article_settings_user_id ON public.article_settings USING btree (user_id);


--
-- Name: idx_articles_distillation; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_articles_distillation ON public.articles USING btree (distillation_id);


--
-- Name: idx_articles_distillation_keyword_snapshot; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_articles_distillation_keyword_snapshot ON public.articles USING btree (distillation_keyword_snapshot);


--
-- Name: idx_articles_image_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_articles_image_id ON public.articles USING btree (image_id);


--
-- Name: idx_articles_is_published; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_articles_is_published ON public.articles USING btree (is_published);


--
-- Name: idx_articles_keyword; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_articles_keyword ON public.articles USING btree (keyword);


--
-- Name: idx_articles_publishing_status; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_articles_publishing_status ON public.articles USING btree (publishing_status);


--
-- Name: idx_articles_task_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_articles_task_id ON public.articles USING btree (task_id);


--
-- Name: idx_articles_title; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_articles_title ON public.articles USING btree (title);


--
-- Name: idx_articles_topic_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_articles_topic_id ON public.articles USING btree (topic_id);


--
-- Name: idx_articles_user_created; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_articles_user_created ON public.articles USING btree (user_id, created_at DESC);


--
-- Name: idx_articles_user_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_articles_user_id ON public.articles USING btree (user_id);


--
-- Name: idx_articles_user_published_created; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_articles_user_published_created ON public.articles USING btree (user_id, is_published, created_at DESC);


--
-- Name: idx_conversion_targets_company_name; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_conversion_targets_company_name ON public.conversion_targets USING btree (company_name);


--
-- Name: idx_conversion_targets_created_at; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_conversion_targets_created_at ON public.conversion_targets USING btree (created_at DESC);


--
-- Name: idx_conversion_targets_user_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_conversion_targets_user_id ON public.conversion_targets USING btree (user_id);


--
-- Name: idx_distillation_config_active; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_distillation_config_active ON public.distillation_config USING btree (is_active);


--
-- Name: idx_distillation_config_user_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_distillation_config_user_id ON public.distillation_config USING btree (user_id);


--
-- Name: idx_distillation_usage_article_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_distillation_usage_article_id ON public.distillation_usage USING btree (article_id);


--
-- Name: idx_distillation_usage_distillation_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_distillation_usage_distillation_id ON public.distillation_usage USING btree (distillation_id);


--
-- Name: idx_distillation_usage_task_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_distillation_usage_task_id ON public.distillation_usage USING btree (task_id);


--
-- Name: idx_distillations_keyword; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_distillations_keyword ON public.distillations USING btree (keyword);


--
-- Name: idx_distillations_usage_count; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_distillations_usage_count ON public.distillations USING btree (usage_count DESC);


--
-- Name: idx_distillations_user_created; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_distillations_user_created ON public.distillations USING btree (user_id, created_at DESC);


--
-- Name: idx_distillations_user_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_distillations_user_id ON public.distillations USING btree (user_id);


--
-- Name: idx_image_usage_article_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_image_usage_article_id ON public.image_usage USING btree (article_id);


--
-- Name: idx_image_usage_image_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_image_usage_image_id ON public.image_usage USING btree (image_id);


--
-- Name: idx_images_album_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_images_album_id ON public.images USING btree (album_id);


--
-- Name: idx_images_created_at; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_images_created_at ON public.images USING btree (created_at DESC);


--
-- Name: idx_images_deleted_at; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_images_deleted_at ON public.images USING btree (deleted_at);


--
-- Name: idx_images_is_orphan; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_images_is_orphan ON public.images USING btree (is_orphan);


--
-- Name: idx_images_orphan; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_images_orphan ON public.images USING btree (is_orphan) WHERE (is_orphan = true);


--
-- Name: idx_images_usage_count; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_images_usage_count ON public.images USING btree (album_id, usage_count, created_at);


--
-- Name: idx_images_user_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_images_user_id ON public.images USING btree (user_id);


--
-- Name: idx_knowledge_bases_created_at; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_knowledge_bases_created_at ON public.knowledge_bases USING btree (created_at DESC);


--
-- Name: idx_knowledge_bases_user_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_knowledge_bases_user_id ON public.knowledge_bases USING btree (user_id);


--
-- Name: idx_knowledge_documents_created_at; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_knowledge_documents_created_at ON public.knowledge_documents USING btree (created_at DESC);


--
-- Name: idx_knowledge_documents_kb_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_knowledge_documents_kb_id ON public.knowledge_documents USING btree (knowledge_base_id);


--
-- Name: idx_platform_accounts_platform; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_platform_accounts_platform ON public.platform_accounts USING btree (platform);


--
-- Name: idx_platform_accounts_platform_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_platform_accounts_platform_id ON public.platform_accounts USING btree (platform_id);


--
-- Name: idx_platform_accounts_status; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_platform_accounts_status ON public.platform_accounts USING btree (status);


--
-- Name: idx_platform_accounts_user_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_platform_accounts_user_id ON public.platform_accounts USING btree (user_id);


--
-- Name: idx_platform_accounts_user_platform; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_platform_accounts_user_platform ON public.platform_accounts USING btree (user_id, platform_id);


--
-- Name: idx_publishing_logs_level; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_logs_level ON public.publishing_logs USING btree (level);


--
-- Name: idx_publishing_logs_task; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_logs_task ON public.publishing_logs USING btree (task_id);


--
-- Name: idx_publishing_records_account_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_records_account_id ON public.publishing_records USING btree (account_id);


--
-- Name: idx_publishing_records_article_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_records_article_id ON public.publishing_records USING btree (article_id);


--
-- Name: idx_publishing_records_article_keyword; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_records_article_keyword ON public.publishing_records USING btree (article_keyword);


--
-- Name: idx_publishing_records_platform_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_records_platform_id ON public.publishing_records USING btree (platform_id);


--
-- Name: idx_publishing_records_published_at; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_records_published_at ON public.publishing_records USING btree (published_at DESC);


--
-- Name: idx_publishing_records_publishing_status; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_records_publishing_status ON public.publishing_records USING btree (publishing_status);


--
-- Name: idx_publishing_records_status; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_records_status ON public.publishing_records USING btree (status);


--
-- Name: idx_publishing_records_task; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_records_task ON public.publishing_records USING btree (task_id);


--
-- Name: idx_publishing_records_task_platform; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_records_task_platform ON public.publishing_records USING btree (task_id, platform_id);


--
-- Name: idx_publishing_records_user_article; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_records_user_article ON public.publishing_records USING btree (user_id, article_id);


--
-- Name: idx_publishing_records_user_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_records_user_id ON public.publishing_records USING btree (user_id);


--
-- Name: idx_publishing_records_user_platform; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_records_user_platform ON public.publishing_records USING btree (user_id, platform_id);


--
-- Name: idx_publishing_records_user_task; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_records_user_task ON public.publishing_records USING btree (user_id, task_id);


--
-- Name: idx_publishing_tasks_article; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_tasks_article ON public.publishing_tasks USING btree (article_id);


--
-- Name: idx_publishing_tasks_batch_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_tasks_batch_id ON public.publishing_tasks USING btree (batch_id);


--
-- Name: idx_publishing_tasks_scheduled; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_tasks_scheduled ON public.publishing_tasks USING btree (scheduled_at);


--
-- Name: idx_publishing_tasks_status; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_tasks_status ON public.publishing_tasks USING btree (status);


--
-- Name: idx_publishing_tasks_user_created; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_tasks_user_created ON public.publishing_tasks USING btree (user_id, created_at DESC);


--
-- Name: idx_publishing_tasks_user_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_tasks_user_id ON public.publishing_tasks USING btree (user_id);


--
-- Name: idx_publishing_tasks_user_status; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_tasks_user_status ON public.publishing_tasks USING btree (user_id, status);


--
-- Name: idx_publishing_tasks_user_status_created; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_publishing_tasks_user_status_created ON public.publishing_tasks USING btree (user_id, status, created_at DESC);


--
-- Name: idx_topic_usage_article_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_topic_usage_article_id ON public.topic_usage USING btree (article_id);


--
-- Name: idx_topic_usage_distillation_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_topic_usage_distillation_id ON public.topic_usage USING btree (distillation_id);


--
-- Name: idx_topic_usage_keyword; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_topic_usage_keyword ON public.topic_usage USING btree (keyword);


--
-- Name: idx_topic_usage_task_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_topic_usage_task_id ON public.topic_usage USING btree (task_id);


--
-- Name: idx_topic_usage_topic_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_topic_usage_topic_id ON public.topic_usage USING btree (topic_id);


--
-- Name: idx_topics_distillation; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_topics_distillation ON public.topics USING btree (distillation_id);


--
-- Name: idx_topics_keyword; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_topics_keyword ON public.topics USING btree (keyword);


--
-- Name: idx_topics_usage_count; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_topics_usage_count ON public.topics USING btree (usage_count DESC);


--
-- Name: idx_topics_user_created; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_topics_user_created ON public.topics USING btree (user_id, created_at DESC);


--
-- Name: idx_topics_user_id; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE INDEX idx_topics_user_id ON public.topics USING btree (user_id);


--
-- Name: unique_user_platform_real_username; Type: INDEX; Schema: public; Owner: geo_user
--

CREATE UNIQUE INDEX unique_user_platform_real_username ON public.platform_accounts USING btree (user_id, platform_id, COALESCE(real_username, account_name));


--
-- Name: INDEX unique_user_platform_real_username; Type: COMMENT; Schema: public; Owner: geo_user
--

COMMENT ON INDEX public.unique_user_platform_real_username IS '确保同一用户在同一平台下不能有重复的真实用户名账号';


--
-- Name: articles trigger_sync_article_distillation_snapshot; Type: TRIGGER; Schema: public; Owner: geo_user
--

CREATE TRIGGER trigger_sync_article_distillation_snapshot BEFORE INSERT OR UPDATE OF topic_id, distillation_id ON public.articles FOR EACH ROW EXECUTE FUNCTION public.sync_article_distillation_snapshot();


--
-- Name: publishing_records trigger_sync_publishing_record_account_snapshot; Type: TRIGGER; Schema: public; Owner: geo_user
--

CREATE TRIGGER trigger_sync_publishing_record_account_snapshot BEFORE INSERT ON public.publishing_records FOR EACH ROW EXECUTE FUNCTION public.sync_publishing_record_account_snapshot();


--
-- Name: publishing_tasks trigger_sync_publishing_task_account_snapshot; Type: TRIGGER; Schema: public; Owner: geo_user
--

CREATE TRIGGER trigger_sync_publishing_task_account_snapshot BEFORE INSERT ON public.publishing_tasks FOR EACH ROW EXECUTE FUNCTION public.sync_publishing_task_account_snapshot();


--
-- Name: topics trigger_sync_topic_snapshot; Type: TRIGGER; Schema: public; Owner: geo_user
--

CREATE TRIGGER trigger_sync_topic_snapshot BEFORE INSERT ON public.topics FOR EACH ROW EXECUTE FUNCTION public.sync_topic_snapshot();


--
-- Name: topic_usage trigger_sync_topic_usage_keyword_snapshot; Type: TRIGGER; Schema: public; Owner: geo_user
--

CREATE TRIGGER trigger_sync_topic_usage_keyword_snapshot BEFORE INSERT ON public.topic_usage FOR EACH ROW EXECUTE FUNCTION public.sync_topic_usage_keyword_snapshot();


--
-- Name: articles trigger_update_article_image_size; Type: TRIGGER; Schema: public; Owner: geo_user
--

CREATE TRIGGER trigger_update_article_image_size BEFORE INSERT OR UPDATE OF image_url ON public.articles FOR EACH ROW EXECUTE FUNCTION public.update_article_image_size();


--
-- Name: albums albums_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

-- REMOVED: user_id foreign key (cross-database reference)


--
-- Name: article_settings article_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

-- REMOVED: user_id foreign key (cross-database reference)


--
-- Name: articles articles_distillation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_distillation_id_fkey FOREIGN KEY (distillation_id) REFERENCES public.distillations(id) ON DELETE SET NULL;


--
-- Name: articles articles_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id) ON DELETE SET NULL;


--
-- Name: articles articles_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

-- REMOVED: task_id foreign key (cross-database reference)


--
-- Name: articles articles_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE SET NULL;


--
-- Name: articles articles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

-- REMOVED: user_id foreign key (cross-database reference)


--
-- Name: conversion_targets conversion_targets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

-- REMOVED: user_id foreign key (cross-database reference)


--
-- Name: distillation_config distillation_config_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

-- REMOVED: user_id foreign key (cross-database reference)


--
-- Name: distillation_usage distillation_usage_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.distillation_usage
    ADD CONSTRAINT distillation_usage_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;


--
-- Name: distillation_usage distillation_usage_distillation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.distillation_usage
    ADD CONSTRAINT distillation_usage_distillation_id_fkey FOREIGN KEY (distillation_id) REFERENCES public.distillations(id) ON DELETE CASCADE;


--
-- Name: distillation_usage distillation_usage_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

-- REMOVED: task_id foreign key (cross-database reference)


--
-- Name: distillations distillations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

-- REMOVED: user_id foreign key (cross-database reference)


--
-- Name: publishing_records fk_publishing_records_user; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

-- REMOVED: user_id foreign key (cross-database reference)


--
-- Name: image_usage image_usage_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.image_usage
    ADD CONSTRAINT image_usage_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;


--
-- Name: image_usage image_usage_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.image_usage
    ADD CONSTRAINT image_usage_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id) ON DELETE CASCADE;


--
-- Name: images images_album_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_album_id_fkey FOREIGN KEY (album_id) REFERENCES public.albums(id) ON DELETE SET NULL;


--
-- Name: images images_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

-- REMOVED: user_id foreign key (cross-database reference)


--
-- Name: knowledge_bases knowledge_bases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

-- REMOVED: user_id foreign key (cross-database reference)


--
-- Name: knowledge_documents knowledge_documents_knowledge_base_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_knowledge_base_id_fkey FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;


--
-- Name: platform_accounts platform_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

-- REMOVED: user_id foreign key (cross-database reference)


--
-- Name: publishing_logs publishing_logs_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.publishing_logs
    ADD CONSTRAINT publishing_logs_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.publishing_tasks(id) ON DELETE CASCADE;


--
-- Name: publishing_records publishing_records_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.publishing_records
    ADD CONSTRAINT publishing_records_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.platform_accounts(id) ON DELETE CASCADE;


--
-- Name: publishing_records publishing_records_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.publishing_records
    ADD CONSTRAINT publishing_records_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE SET NULL;


--
-- Name: publishing_records publishing_records_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.publishing_records
    ADD CONSTRAINT publishing_records_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.publishing_tasks(id) ON DELETE SET NULL;


--
-- Name: publishing_records publishing_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

-- REMOVED: user_id foreign key (cross-database reference)


--
-- Name: publishing_tasks publishing_tasks_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.publishing_tasks
    ADD CONSTRAINT publishing_tasks_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.platform_accounts(id) ON DELETE CASCADE;


--
-- Name: publishing_tasks publishing_tasks_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.publishing_tasks
    ADD CONSTRAINT publishing_tasks_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE SET NULL;


--
-- Name: publishing_tasks publishing_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

-- REMOVED: user_id foreign key (cross-database reference)


--
-- Name: topic_usage topic_usage_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.topic_usage
    ADD CONSTRAINT topic_usage_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;


--
-- Name: topic_usage topic_usage_distillation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.topic_usage
    ADD CONSTRAINT topic_usage_distillation_id_fkey FOREIGN KEY (distillation_id) REFERENCES public.distillations(id) ON DELETE CASCADE;


--
-- Name: topic_usage topic_usage_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

-- REMOVED: task_id foreign key (cross-database reference)


--
-- Name: topic_usage topic_usage_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.topic_usage
    ADD CONSTRAINT topic_usage_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE CASCADE;


--
-- Name: topics topics_distillation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_distillation_id_fkey FOREIGN KEY (distillation_id) REFERENCES public.distillations(id) ON DELETE SET NULL;


--
-- Name: topics topics_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: geo_user
--

-- REMOVED: user_id foreign key (cross-database reference)


--
-- PostgreSQL database dump complete
--

\unrestrict tU2i0IcpSmFh9YShh802PgUohbEJk2lREO1s8E3LV3x3EMoAr2Acje1ccC188K1

