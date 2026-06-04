// @ts-nocheck
export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
}

export interface BlogArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category_id: string | null;
  image_url: string | null;
  author: string;
  read_time: number;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  published: boolean;
  published_at: string;
  created_by: string | null;
  generation_prompt: string | null;
  ai_model_used: string;
  views_count: number;
  created_at: string;
  updated_at: string;
  blog_categories?: BlogCategory | null;
}
