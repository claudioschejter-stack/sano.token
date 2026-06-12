export type BlogSection = {
  heading: string;
  paragraphs: string[];
};

export type BlogArticle = {
  slug: string;
  publishedAt: string;
  title: string;
  description: string;
  keywords: string[];
  sections: BlogSection[];
};
