
export interface ColorTheme {
  name: string;
  description: string;
  colors: {
    primary: string;
    primaryDark: string;
    secondary: string;
    background: string;
    text: string;
    highlightBg: string;
    infoBoxBg: string;
    infoBoxBorder: string;
    warningBoxBg: string;
    warningBoxBorder: string;
    tableHeaderBg: string;
    tableBorder: string;
    tableEvenRowBg: string;
  };
}

export interface SupplementaryInfo {
  keywords: string[];
  imagePrompt: string;
  altText: string;
  seoTitles: string[];
  thumbnailTitles: string[];
  subImagePrompts: { prompt: string; altText: string }[];
}

export interface SocialMediaPosts {
  threads: string;
  instagram: string;
  facebook: string;
  x: string;
}

export interface GeneratedContent {
  blogPostHtml: string;
  supplementaryInfo: SupplementaryInfo;
  imageBase64: string | null;
  subImages: { prompt: string; altText: string; base64: string | null }[] | null;
  socialMediaPosts?: SocialMediaPosts;
}


// --- Keyword Fighter Types ---

export type SearchSource = 'google' | 'naver';
export type Feature = 'competition' | 'keywords' | 'related-keywords' | 'naver-news' | 'blogs' | 'sustainable-topics' | 'recommended';

export interface KeywordData {
    id: number;
    keyword: string;
}

export interface NaverNewsData {
    id: string;
    title: string;
    url: string;
    description: string;
    pubDate: string;
}

export interface NewsStrategyIdea {
    id: number;
    title: string;
    keywords: string[];
    strategy: string;
}

export interface BlogPostData {
    id: number;
    title: string;
    url: string;
}

export interface KeywordMetrics {
    keyword: string;
    opportunityScore: number;
    searchVolumeEstimate: number;
    competitionScore: number;
    competitionLevel: string;
    documentCount: number;
    analysis: {
        title: string;
        reason: string;
        opportunity: string;
        threat: string;
        consumptionAndIssues: string;
        conclusion: string;
    };
    strategy?: {
        expandedKeywords: string[];
        blogTopics: {
            title: string;
            description: string;
        }[];
    };
    keywordLength: number;
    wordCount: number;
}

export interface GeneratedTopic {
    id: number;
    title: string;
    thumbnailCopy: string;
    strategy: string;
}

export interface BlogStrategyReportData {
    analysis: {
        structure: string;
        characteristics: string;
        commonKeywords: string;
    };
    suggestions: GeneratedTopic[];
}

export interface RecommendedKeyword extends GeneratedTopic {
    keyword: string;
    reason: string;
}

export interface SustainableTopicSuggestion {
    title: string;
    keywords: string[];
    strategy: string;
}

export interface SustainableTopicCategory {
    category: string;
    suggestions: SustainableTopicSuggestion[];
}

export interface PaaItem {
    question: string;
    answer: string;
    content_gap_analysis: string;
}

export interface GoogleSerpData {
    related_searches: string[];
    people_also_ask: PaaItem[];
}

export interface SerpStrategyReportData {
    analysis: {
        userIntent: string;
        pillarPostSuggestion: string;
    };
    suggestions: GeneratedTopic[];
}

export interface Prompt {
  id: number;
  title: string;
  template: string;
}

export interface PromptCategory {
  category: string;
  prompts: Prompt[];
}

export interface WeatherData {
    temperature: string;
    condition: string;
    wind: string;
    humidity: string;
}