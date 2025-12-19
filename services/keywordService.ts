
import type { KeywordData, SearchSource, BlogPostData, KeywordMetrics, GeneratedTopic, BlogStrategyReportData, RecommendedKeyword, SustainableTopicCategory, GoogleSerpData, PaaItem, SerpStrategyReportData, WeatherData, NaverNewsData, NewsStrategyIdea } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

// NOTE: To combat the inherent unreliability of public CORS proxies, this service employs a highly resilient, multi-strategy approach.
// 1. Diverse Strategies: It uses a list of proxies that work differently (e.g., direct pass-through vs. JSON-wrapped content), increasing the chance that at least one method will bypass blocking or server issues.
// 2. Increased Timeout: A generous 15-second timeout accommodates slower proxies.
// 3. Intelligent Retry: Network errors on a proxy are retried once automatically.
// 4. Smart Fallback: If a proxy fails consistently, the service automatically moves to the next strategy in the list.

interface Proxy {
    name: string;
    buildUrl: (url: string) => string;
    parseResponse: (response: Response) => Promise<string>;
}

const PROXIES: Proxy[] = [
    {
        name: 'corsproxy.io',
        buildUrl: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
        parseResponse: (response) => response.text(),
    },
    {
        name: 'thingproxy.freeboard.io',
        buildUrl: (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
        parseResponse: (response) => response.text(),
    },
];

const MAX_RETRIES_PER_PROXY = 2; // 1 initial attempt + 1 retry
const RETRY_DELAY_MS = 1000;
const FETCH_TIMEOUT_MS = 15000;

/**
 * Extracts and parses a JSON object from a string that may contain markdown and other text.
 * It intelligently finds the end of the JSON structure by balancing brackets.
 * @param text The raw string from the AI response.
 * @returns The parsed JSON object.
 * @throws An error if JSON cannot be found or parsed.
 */
function extractJsonFromText(text: string): any {
    let jsonString = text.trim();

    // Attempt to find JSON within markdown code blocks first
    const markdownMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        jsonString = markdownMatch[1].trim();
    }

    const startIndex = jsonString.search(/[[{]/);
    if (startIndex === -1) {
        throw new Error('AI 응답에서 유효한 JSON을 찾을 수 없습니다.');
    }

    const startChar = jsonString[startIndex];
    const endChar = startChar === '[' ? ']' : '}';
    let openCount = 0;
    let endIndex = -1;

    // Find the matching closing bracket/brace, ignoring those inside strings
    let inString = false;
    let escapeChar = false;
    for (let i = startIndex; i < jsonString.length; i++) {
        const char = jsonString[i];

        if (escapeChar) {
            escapeChar = false;
            continue;
        }
        if (char === '\\') {
            escapeChar = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
        }

        if (!inString) {
            if (char === startChar) {
                openCount++;
            } else if (char === endChar) {
                openCount--;
            }
        }

        if (openCount === 0) {
            endIndex = i;
            break;
        }
    }
    
    // Fallback to old logic if bracket matching fails for some reason
    if (endIndex === -1) {
        const lastBrace = jsonString.lastIndexOf('}');
        const lastBracket = jsonString.lastIndexOf(']');
        endIndex = Math.max(lastBrace, lastBracket);
    }
    
    if (endIndex === -1) {
        throw new Error('AI 응답에서 유효한 JSON의 끝을 찾을 수 없습니다.');
    }

    const potentialJson = jsonString.substring(startIndex, endIndex + 1);

    try {
        return JSON.parse(potentialJson);
    } catch (error) {
        console.error("JSON 파싱 실패. 원본 텍스트:", text);
        console.error("추출된 JSON 문자열:", potentialJson);
        if (error instanceof Error) {
            throw new Error(`AI가 반환한 데이터의 형식이 잘못되었습니다. 오류: ${error.message}`);
        }
        throw new Error('AI가 반환한 데이터의 형식이 잘못되었습니다.');
    }
}


const fetchWithTimeout = async (resource: RequestInfo, options: RequestInit & { timeout?: number } = {}): Promise<Response> => {
    const { timeout = FETCH_TIMEOUT_MS } = options;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort('Timeout'), timeout);

    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
};

const fetchWithProxies = async (targetUrl: string, responseParser: (text: string) => any) => {
    let lastKnownError: Error | null = null;
     for (const proxy of PROXIES) {
        const proxyUrl = proxy.buildUrl(targetUrl);
        
        for (let attempt = 1; attempt <= MAX_RETRIES_PER_PROXY; attempt++) {
            try {
                const response = await fetchWithTimeout(proxyUrl, { timeout: FETCH_TIMEOUT_MS });
                if (!response.ok) {
                    lastKnownError = new Error(`HTTP 오류! 상태: ${response.status}.`);
                    break;
                }
                
                const rawContent = await proxy.parseResponse(response);
                if (!rawContent) {
                    lastKnownError = new Error('프록시에서 빈 콘텐츠를 반환했습니다.');
                    continue;
                }
                return responseParser(rawContent);

            } catch (error) {
                if (error instanceof Error) {
                   lastKnownError = error;
                } else {
                   lastKnownError = new Error("알 수 없는 요청 오류가 발생했습니다.");
                }
                if (attempt < MAX_RETRIES_PER_PROXY) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                }
            }
        }
    }
    
    // If we're here, all proxies and retries have failed.
     if (lastKnownError instanceof Error) {
        if (lastKnownError?.message.includes('Timeout')) {
            throw new Error('요청 시간이 초과되었습니다. 네트워크 연결이 느리거나 모든 프록시 서버가 응답하지 않습니다.');
        }
        if (lastKnownError instanceof TypeError && lastKnownError.message.includes('fetch')) {
            throw new Error('네트워크 요청에 실패했습니다. 모든 프록시 서버에 연결할 수 없습니다. 인터넷 연결, 브라우저의 광고 차단기(AdBlocker) 또는 보안 설정을 확인하거나 잠시 후 다시 시도해 주세요.');
        }
        throw new Error(`모든 프록시 서버에서 데이터를 가져오는 데 실패했습니다. 마지막 오류: ${lastKnownError?.message || '알 수 없는 오류'}. 잠시 후 다시 시도해 주세요.`);
    }
    throw new Error(`데이터를 가져오지 못했습니다.`);
};

// --- Naver API Specific Functions ---
const callNaverApi = async (endpoint: string, params: Record<string, string>, clientId: string, clientSecret: string) => {
    const queryString = new URLSearchParams(params).toString();
    const targetUrl = `https://openapi.naver.com${endpoint}?${queryString}`;
    let lastKnownError: Error | null = null;

    for (const proxy of PROXIES) {
        try {
            const proxyUrl = proxy.buildUrl(targetUrl);
            const response = await fetchWithTimeout(proxyUrl, {
                headers: {
                    'X-Naver-Client-Id': clientId,
                    'X-Naver-Client-Secret': clientSecret
                }
            });

            const responseData = await response.json();

            if (!response.ok) {
                const errorMessage = responseData.errorMessage || `HTTP status ${response.status}`;
                const errorCode = responseData.errorCode || 'N/A';
                throw new Error(`Naver API 오류: ${errorMessage} (코드: ${errorCode})`);
            }
            
            return responseData;

        } catch (error) {
            lastKnownError = error instanceof Error ? error : new Error(String(error));
        }
    }
    throw lastKnownError || new Error('모든 프록시를 통한 Naver API 호출에 실패했습니다.');
};


export const testNaverCredentials = async (clientId: string, clientSecret: string): Promise<boolean> => {
    try {
        await callNaverApi('/v1/search/blog.json', { query: 'test', display: '1' }, clientId, clientSecret);
        return true;
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('Authentication failed') || error.message.includes('401')) {
                throw new Error('인증에 실패했습니다. 클라이언트 ID와 시크릿을 확인해주세요.');
            }
        }
        throw error;
    }
};

export const fetchNaverNews = async (keyword: string, clientId: string, clientSecret: string): Promise<NaverNewsData[]> => {
    if (!keyword.trim()) {
        throw new Error("키워드가 비어있습니다.");
    }

    const data = await callNaverApi('/v1/search/news.json', { query: keyword, display: '10', sort: 'sim' }, clientId, clientSecret);

    if (!data.items || !Array.isArray(data.items)) {
        throw new Error('Naver API에서 유효한 뉴스 데이터를 받지 못했습니다.');
    }
    
    const stripHtml = (html: string) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || "";
    }

    return data.items.map((item: any): NaverNewsData => ({
        id: item.link,
        title: stripHtml(item.title),
        url: item.link,
        description: stripHtml(item.description),
        pubDate: item.pubDate,
    }));
};

export const generateStrategyFromNews = async (news: NaverNewsData[]): Promise<NewsStrategyIdea[]> => {
    if (!news || news.length === 0) {
        throw new Error("분석할 뉴스 데이터가 없습니다.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const today = new Date();
    const formattedDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

    const newsContext = news.map(item => `- 제목: ${item.title}\n  - 요약: ${item.description}`).join('\n');

    const prompt = `
당신은 트렌드에 민감한 최고의 SEO 콘텐츠 전략가입니다.

**분석 기준일: ${formattedDate}**

아래는 방금 수집된 실시간 네이버 뉴스 목록입니다.

[실시간 뉴스 목록]
${newsContext}

[지시사항]
1.  **핵심 트렌드 분석**: 위 뉴스 목록을 종합하여 현재 사용자들이 가장 관심을 보일 만한 핵심 주제나 트렌드가 무엇인지 파악합니다.
2.  **블로그 공략법 제안**: 분석한 트렌드를 기반으로, 검색 상위 노출 및 바이럴을 유도할 수 있는 구체적인 블로그 포스팅 아이디어 3가지를 제안해 주세요.

**출력 형식**: 다른 설명 없이, 아래 JSON 스키마에 맞는 JSON 배열 코드 블록 하나만으로 응답해주세요. 각 아이디어는 고유해야 합니다.

- title: 사용자의 클릭을 유도하는 매력적인 블로그 제목.
- keywords: SEO를 위한 핵심 키워드 5개.
- strategy: 어떤 내용을 어떤 순서로 구성해야 독자의 흥미를 끌고 문제를 해결해 줄 수 있는지에 대한 구체적인 전략.
    `.trim();
    
    const responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          keywords: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          strategy: { type: Type.STRING }
        },
        required: ['title', 'keywords', 'strategy']
      }
    };


    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });
        
        const parsed = JSON.parse(response.text.trim());

        if (!Array.isArray(parsed)) {
            throw new Error('AI 응답이 배열 형식이 아닙니다.');
        }

        return parsed.map((item, index) => ({
            id: index + 1,
            title: item.title,
            keywords: item.keywords,
            strategy: item.strategy,
        }));
    } catch (error) {
        console.error("뉴스 전략 생성 중 Gemini API 오류:", error);
        if (error instanceof Error) {
            throw new Error(`AI 뉴스 전략 생성에 실패했습니다: ${error.message}`);
        }
        throw new Error("AI 뉴스 전략 생성 중 알 수 없는 오류가 발생했습니다.");
    }
};



export const generateRelatedKeywords = async (keyword: string): Promise<GoogleSerpData> => {
    if (!keyword.trim()) {
        throw new Error("키워드가 비어있습니다.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const today = new Date();
    const formattedDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

    const prompt = `
    당신은 Google 검색을 활용하여 실시간 정보를 분석하는 최고의 SEO 전문가이자 콘텐츠 전략가입니다.

    **분석 기준일: ${formattedDate}**
    
    당신의 임무는 키워드 "${keyword}"에 대한 Google 검색을 **실시간으로 수행**하고, 그 결과에서 아래 데이터를 정확하게 추출 및 분석하는 것입니다.

    [매우 중요한 지시사항]
    - **실시간 검색 수행**: 반드시 Google 검색 도구를 사용하여 **현재 시점의 최신 정보**를 가져와야 합니다.
    - **최신 정보 우선**: 특히 '다른 사람들이 함께 찾는 질문(PAA)' 항목은 오늘 날짜 또는 최근 24시간 이내의 뉴스 기사, 보도자료 등 가장 최신 정보를 기반으로 답변을 구성해야 합니다. 과거 정보는 절대 포함해서는 안 됩니다.
    - **철저한 관련성 검증**: 추출하는 모든 데이터는 반드시 입력 키워드 "${keyword}"와 직접적으로 관련이 있어야 합니다.

    [추출 및 분석할 데이터]
    1.  **'관련 검색어'(Related Searches)**: 검색 결과 페이지 하단에 표시되는 목록에서 **가장 관련성 높은 순서대로 정확히 10개**를 추출합니다.
    2.  **'다른 사람들이 함께 찾는 질문'(People Also Ask)**: 검색 결과 중간에 표시되는 질문 목록에서 **가장 중요하고 관련성 높은 순서대로 정확히 5개**를 추출하여 아래 항목을 분석합니다.
        - **answer**: 질문에 대한 가장 최신 정보를 바탕으로 한, 간결하고 명확한 요약 답변.
        - **content_gap_analysis**: **(가장 중요)** 현재 검색 결과들이 이 질문에 대해 '무엇을 놓치고 있는지' 분석합니다. 사용자의 숨겨진 의도, 더 깊이 있는 정보에 대한 니즈, 해결되지 않은 문제점 등을 구체적으로 지적하고, 어떤 콘텐츠를 만들어야 경쟁에서 이길 수 있는지 '공략 포인트'를 제시합니다.

    [출력 형식]
    - 다른 텍스트, 설명, 서론 없이 오직 아래 JSON 형식에 맞춰 **JSON 코드 블록 하나만으로** 응답해 주세요.
    - 만약 특정 섹션을 찾을 수 없다면, 해당 키에 빈 배열을 반환하세요.

    \`\`\`json
    {
      "related_searches": ["추출된 관련 검색어 1", "추출된 관련 검색어 2", "추출된 관련 검색어 3", "추출된 관련 검색어 4", "추출된 관련 검색어 5", "추출된 관련 검색어 6", "추출된 관련 검색어 7", "추출된 관련 검색어 8", "추출된 관련 검색어 9", "추출된 관련 검색어 10"],
      "people_also_ask": [
        {
          "question": "추출된 질문 1",
          "answer": "가장 최신 정보를 기반으로 요약된 답변 1",
          "content_gap_analysis": "현재 검색 결과는 A라는 사실만 알려줍니다. 하지만 사용자는 A가 자신의 B에 어떤 영향을 미치는지 구체적인 예시와 해결책을 원합니다. 이 부분을 공략해야 합니다."
        },
        {
          "question": "추출된 질문 2",
          "answer": "가장 최신 정보를 기반으로 요약된 답변 2",
          "content_gap_analysis": "대부분의 글이 원론적인 설명에 그칩니다. 사용자는 따라하기 쉬운 단계별 가이드나 실제 적용 후기를 찾고 있습니다. 체크리스트나 실제 사례를 포함한 콘텐츠가 필요합니다."
        },
        {
          "question": "추출된 질문 3",
          "answer": "가장 최신 정보를 기반으로 요약된 답변 3",
          "content_gap_analysis": "관련 법규나 정책의 변경 사항이 제대로 반영되지 않은 정보가 많습니다. 가장 최신 기준으로 변경된 내용을 명확히 비교하고 설명하는 콘텐츠가 경쟁 우위를 가질 것입니다."
        },
        {
          "question": "추출된 질문 4",
          "answer": "가장 최신 정보를 기반으로 요약된 답변 4",
          "content_gap_analysis": "긍정적인 측면만 부각하는 글들이 대부분입니다. 사용자는 잠재적인 단점이나 리스크, 주의사항에 대한 현실적인 정보를 원하고 있습니다."
        },
        {
          "question": "추출된 질문 5",
          "answer": "가장 최신 정보를 기반으로 요약된 답변 5",
          "content_gap_analysis": "전문 용어가 너무 많아 초보자가 이해하기 어렵습니다. 어려운 개념을 비유나 쉬운 사례를 들어 설명해주는 콘텐츠가 높은 평가를 받을 것입니다."
        }
      ]
    }
    \`\`\`
  `.trim();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
      },
    });

    const result = extractJsonFromText(response.text);
    
    // Type validation and cleaning
    if (result && Array.isArray(result.related_searches) && Array.isArray(result.people_also_ask)) {
       const citationRegex = /\[\d+(, ?\d+)*\]/g;

       const cleanedPaas = result.people_also_ask.map((paa: PaaItem) => ({
           question: (paa.question || '').replace(citationRegex, '').trim(),
           answer: (paa.answer || '').replace(citationRegex, '').trim(),
           content_gap_analysis: (paa.content_gap_analysis || '').replace(citationRegex, '').trim(),
       })).slice(0, 5);

       const cleanedRelatedSearches = result.related_searches.map((search: string) => 
           (search || '').replace(citationRegex, '').trim()
       );

       return {
           related_searches: cleanedRelatedSearches,
           people_also_ask: cleanedPaas,
       };
    } else {
       throw new Error("API 응답이 예상된 형식이 아닙니다.");
    }

  } catch (error) {
    console.error("Gemini API 호출 중 오류 발생:", error);
    if (error instanceof Error) {
        throw new Error(`AI 모델로부터 검색 결과를 가져오는 데 실패했습니다. 오류: ${error.message}`);
    }
    throw new Error("AI 모델로부터 검색 결과를 가져오는 데 실패했습니다.");
  }
};


const fetchSingleTermKeywords = async (term: string, source: SearchSource): Promise<string[]> => {
    const config = (source: SearchSource) => {
        if (source === 'naver') {
            return {
                url: `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(term)}&con=1&frm=nx&ans=2&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&run=2&rev=4&q_enc=UTF-8&st=100`,
                parser: (data: any) => {
                    if (!data || !Array.isArray(data.items)) {
                        if (data && data.items === null) return []; 
                        throw new Error("Naver API로부터 예상치 못한 형식의 응답을 받았습니다: 'items' 배열이 없습니다.");
                    }
                    const keywords: string[] = [];
                    for (const itemGroup of data.items) {
                        if (Array.isArray(itemGroup)) {
                            for (const item of itemGroup) {
                                if (Array.isArray(item) && typeof item[0] === 'string') {
                                    keywords.push(item[0]);
                                }
                            }
                        }
                    }
                    return keywords;
                }
            };
        }
        // Default to Google
        return {
            url: `https://suggestqueries.google.com/complete/search?client=chrome&hl=ko&q=${encodeURIComponent(term)}`,
            parser: (data: any) => {
                if (!Array.isArray(data) || !Array.isArray(data[1])) {
                    throw new Error("Google Suggest API로부터 예상치 못한 형식의 응답을 받았습니다.");
                }
                return data[1] || [];
            }
        };
    };

    const { url: targetUrl, parser } = config(source);
    const data = await fetchWithProxies(targetUrl, JSON.parse);
    return parser(data);
};

export const fetchRelatedKeywords = async (keyword: string, source: SearchSource): Promise<KeywordData[]> => {
    if (!keyword.trim()) {
        throw new Error("키워드가 비어있습니다.");
    }
    
    if (source === 'naver') {
        const POSTFIXES = ["", "ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
        const searchTerms = POSTFIXES.map(p => `${keyword} ${p}`.trim());

        const settlements = await Promise.allSettled(
            searchTerms.map(term => fetchSingleTermKeywords(term, 'naver'))
        );
        
        const successfulResults: string[][] = [];
        settlements.forEach(result => {
            if (result.status === 'fulfilled') {
                successfulResults.push(result.value);
            }
        });
        
        if (successfulResults.length === 0) {
           throw new Error(`'${keyword}'에 대한 Naver 자동완성검색어 조회에 실패했습니다. 모든 요청이 거부되었습니다.`);
        }

        const allSuggestions = new Set<string>();
        successfulResults.forEach(suggestions => {
            suggestions.forEach(kw => allSuggestions.add(kw.replace(/<[^>]*>/g, '')));
        });
        
        const finalSuggestions = Array.from(allSuggestions).slice(0, 20);
        return finalSuggestions.map((kw, index) => ({ id: index + 1, keyword: kw }));
    }

    // Google Search Logic
    const suggestions = await fetchSingleTermKeywords(keyword, 'google');
    const finalSuggestions = suggestions.slice(0, 20);
    return finalSuggestions.map((kw, index) => ({ id: index + 1, keyword: kw }));
};


export const fetchNaverBlogPosts = async (keyword: string, clientId: string, clientSecret: string): Promise<BlogPostData[]> => {
    if (!keyword.trim()) {
        throw new Error("키워드가 비어있습니다.");
    }
    
    const data = await callNaverApi('/v1/search/blog.json', { query: keyword, display: '10', sort: 'sim' }, clientId, clientSecret);

    if (!data.items || !Array.isArray(data.items)) {
        throw new Error('Naver API에서 유효한 블로그 데이터를 받지 못했습니다.');
    }

    const stripHtml = (html: string) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || "";
    }

    return data.items.map((item: any, index: number) => ({
        id: index + 1,
        title: stripHtml(item.title),
        url: item.link
    }));
};

export const analyzeKeywordCompetition = async (keyword: string): Promise<KeywordMetrics> => {
    if (!keyword.trim()) {
        throw new Error("키워드가 비어있습니다.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const today = new Date();
    const formattedDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
    
    const prompt = `
당신은 Google 검색을 활용하여 실시간 정보를 분석하는 최고의 SEO 전문가입니다.

**분석 기준일: ${formattedDate}**
분석할 키워드: "${keyword}"

Google 검색을 사용하여 다음 항목에 대한 최신 정보를 조사하고 분석해 주세요:
- 검색 관심도 및 최근 1년간의 검색 트렌드
- 경쟁 강도 (상위 페이지의 권위, 콘텐츠 포화도 등)
- **총 검색 결과 수 (문서 노출 수)**
- **해당 키워드의 현재 소비 현황 (커뮤니티, 뉴스, 소셜 미디어 등) 및 관련 최신 이슈**
- 주요 사용자 의도 (정보성, 상업성 등)

위 분석을 바탕으로, 아래 JSON 형식에 맞춰 **JSON 코드 블록 하나만으로** 응답해 주세요. 모든 텍스트는 **매우 상세하고 구체적으로**, 전문가적인 관점에서 작성하고, 기회/위협/이슈 요인은 **찾을 수 있는 모든 중요한 내용을** 불릿 포인트(-)로 상세히 설명해 주세요. **절대 인용 코드를 포함하지 말고**, 다른 설명은 추가하지 마세요.

- opportunityScore: 성공 가능성을 0~100점으로 평가.
- searchVolumeEstimate: 검색량 수준을 **'검색 관심도 지수'**로 0~100점 평가.
- competitionScore: 경쟁 강도를 **'경쟁 난이도 지수'**로 0~100점 평가 (높을수록 경쟁이 치열).
- competitionLevel: '낮음', '보통', '높음', '매우 높음' 중 하나로 평가.
- documentCount: Google 검색 시 노출되는 총 문서 수 (대략적인 숫자).
- opportunityScore가 80 미만일 경우, **반드시** strategy 필드에 아래 내용을 포함한 SEO 공략 전략을 제안해 주세요. 80 이상일 경우 strategy 필드는 생략합니다.
  - expandedKeywords: 공략 가능한 확장 키워드 3~5개를 배열로 제안.
  - blogTopics: 위 확장 키워드를 활용한, 구체적인 블로그 포스팅 제목 5개와 각 제목에 대한 상세한 공략법(핵심 내용, 구성 방식)을 배열로 제안.

{
  "opportunityScore": 0,
  "searchVolumeEstimate": 0,
  "competitionScore": 0,
  "competitionLevel": "보통",
  "documentCount": 0,
  "analysis": {
    "title": "분석 제목 (핵심 내용을 포함하여 구체적으로)",
    "reason": "점수 산정 핵심 이유 (상세한 설명)",
    "opportunity": "- 상세한 기회 요인 1\\n- 상세한 기회 요인 2\\n- 상세한 기회 요인 3",
    "threat": "- 상세한 위협 요인 1\\n- 상세한 위협 요인 2\\n- 상세한 위협 요인 3",
    "consumptionAndIssues": "- 현재 소비 현황 및 최신 이슈 상세 분석 1\\n- 현재 소비 현황 및 최신 이슈 상세 분석 2",
    "conclusion": "최종 결론 및 실행 전략 (구체적인 실행 방안을 포함하여 3-4문장으로 상세히 요약)"
  },
  "strategy": {
    "expandedKeywords": ["확장 키워드 1", "확장 키워드 2"],
    "blogTopics": [
      {
        "title": "블로그 제목 1",
        "description": "제목 1에 대한 상세 공략법(독자 타겟, 핵심 내용, 글의 구조 등)을 2-3문장으로 요약"
      },
      {
        "title": "블로그 제목 2",
        "description": "제목 2에 대한 상세 공략법 요약"
      }
    ]
  }
}
`.trim();

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{googleSearch: {}}],
            }
        });

        const jsonResponse = extractJsonFromText(response.text);
        
        // --- Data validation ---
        if (
            typeof jsonResponse.opportunityScore !== 'number' ||
            typeof jsonResponse.searchVolumeEstimate !== 'number' ||
            typeof jsonResponse.competitionScore !== 'number' ||
            typeof jsonResponse.competitionLevel !== 'string' ||
            typeof jsonResponse.documentCount !== 'number' ||
            typeof jsonResponse.analysis !== 'object' ||
            typeof jsonResponse.analysis.title !== 'string' ||
            typeof jsonResponse.analysis.reason !== 'string' ||
            typeof jsonResponse.analysis.opportunity !== 'string' ||
            typeof jsonResponse.analysis.threat !== 'string' ||
            typeof jsonResponse.analysis.consumptionAndIssues !== 'string' ||
            typeof jsonResponse.analysis.conclusion !== 'string' ||
            (jsonResponse.strategy && (
                !Array.isArray(jsonResponse.strategy.expandedKeywords) ||
                !Array.isArray(jsonResponse.strategy.blogTopics)
            ))
        ) {
            throw new Error('AI로부터 유효하지 않은 형식의 응답을 받았습니다.');
        }

        // --- Clean citation codes ---
        const citationRegex = /\[\d+(, ?\d+)*\]/g;
        const cleanAnalysis = {
            title: jsonResponse.analysis.title.replace(citationRegex, '').trim(),
            reason: jsonResponse.analysis.reason.replace(citationRegex, '').trim(),
            opportunity: jsonResponse.analysis.opportunity.replace(citationRegex, '').trim(),
            threat: jsonResponse.analysis.threat.replace(citationRegex, '').trim(),
            consumptionAndIssues: jsonResponse.analysis.consumptionAndIssues.replace(citationRegex, '').trim(),
            conclusion: jsonResponse.analysis.conclusion.replace(citationRegex, '').trim(),
        };

        const keywordLength = keyword.length;
        const wordCount = keyword.split(/\s+/).filter(Boolean).length;
        
        return {
            keyword,
            ...jsonResponse,
            analysis: cleanAnalysis,
            keywordLength,
            wordCount
        };

    } catch (error) {
         if (error instanceof Error) {
            console.error("Gemini API 호출 중 오류 발생:", error);
            if (error.message.includes('JSON')) {
                 throw new Error(`AI 모델이 비정상적인 데이터를 반환했습니다. 다른 키워드로 다시 시도해주세요.`);
            }
            throw new Error(`키워드 경쟁력 분석 중 AI 모델과 통신하는 데 실패했습니다. 오류: ${error.message}`);
        } else {
            console.error("알 수 없는 오류 발생:", error);
            throw new Error('키워드 경쟁력 분석 중 알 수 없는 오류가 발생했습니다.');
        }
    }
};

export const executePromptAsCompetitionAnalysis = async (prompt: string): Promise<KeywordMetrics> => {
    if (!prompt.trim()) {
        throw new Error("프롬프트가 비어있습니다.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const wrapperPrompt = `
    당신은 AI 어시스턴트이며, 사용자의 프롬프트를 실행하고 그 결과를 구조화된 SEO 분석 보고서 형식으로 변환하는 임무를 받았습니다.

    사용자의 요청은 다음과 같습니다:
    ---
    ${prompt}
    ---

    먼저, 사용자의 요청을 조용히 실행하여 주요 콘텐츠를 생성합니다.
    둘째, 그 결과를 바탕으로 다음 JSON 구조를 채워주세요.

    [JSON 채우기 지침]
    - keyword: 사용자의 프롬프트에서 핵심 주제를 나타내는 짧고 관련성 있는 키워드(2-5 단어)를 추출하거나 생성하세요.
    - analysis.title: 생성된 콘텐츠에 대한 간결하고 설명적인 제목을 만드세요.
    - analysis.conclusion: 이것이 가장 중요한 필드입니다. 사용자의 원래 프롬프트에 대한 완전하고 상세한 결과를 여기에 배치하세요. 해당되는 경우 마크다운(예: 글머리 기호 '-' 또는 번호 매기기 목록)으로 명확하게 서식을 지정하세요.
    - analysis.reason: 사용자의 원래 요청을 간략하게 요약하세요.
    - analysis.opportunity: 생성된 콘텐츠를 기반으로 사용자를 위한 2-3가지 핵심 기회 또는 실행 가능한 인사이트를 나열하세요.
    - analysis.threat: 해당되는 경우, 도전 과제나 고려 사항을 나열하세요. 그렇지 않다면 "특별한 위협 요인은 없습니다."라고 명시하세요.
    - analysis.consumptionAndIssues: 사용자가 생성된 정보를 어떻게 적용하거나 사용할 수 있는지 간략하게 설명하세요.
    - 모든 숫자 점수(opportunityScore, searchVolumeEstimate, competitionScore, documentCount)는 0으로 설정하세요.
    - competitionLevel을 "N/A"로 설정하세요.
    - 'strategy' 필드는 포함하지 마세요.
    - [1], [2]와 같은 인용 코드는 포함하지 마세요.

    오직 단일 JSON 코드 블록으로만 응답하세요.

    출력 구조 예시:
    {
      "keyword": "롱테일 키워드 발굴",
      "opportunityScore": 0,
      "searchVolumeEstimate": 0,
      "competitionScore": 0,
      "competitionLevel": "N/A",
      "documentCount": 0,
      "analysis": {
        "title": "'캠핑' 관련 롱테일 키워드 30개 분석",
        "reason": "사용자는 '캠핑'과 관련된 월간 검색량 1,000~5,000회의 롱테일 키워드 30개와 관련 분석을 요청했습니다.",
        "opportunity": "- 경쟁이 낮은 세부 키워드를 공략하여 특정 타겟층을 유입시킬 수 있습니다.\\n- 질문형 키워드를 활용하여 정보성 콘텐츠로 신뢰를 구축할 수 있습니다.",
        "threat": "특별한 위협 요인은 없습니다.",
        "consumptionAndIssues": "이 키워드 리스트를 기반으로 월간 콘텐츠 캘린더를 작성하고, 우선순위가 높은 키워드부터 블로그 포스팅을 시작할 수 있습니다.",
        "conclusion": "1. 캠핑 장비 추천 (검색 의도: 탐색형, 경쟁 강도: 중, ...)\\n2. 초보 캠핑 준비물 리스트 (검색 의도: 정보형, 경쟁 강도: 하, ...)\\n(이하 30개 키워드 목록)..."
      }
    }
    `.trim();

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: wrapperPrompt,
            config: {
                tools: [{googleSearch: {}}],
            }
        });

        const jsonResponse = extractJsonFromText(response.text);
        
        if (!jsonResponse.keyword || !jsonResponse.analysis || !jsonResponse.analysis.conclusion) {
            throw new Error('AI로부터 유효하지 않은 형식의 응답을 받았습니다.');
        }

        const safeKeyword = String(jsonResponse.keyword || '');
        const cleanAnalysis = {
            title: String(jsonResponse.analysis.title || ''),
            reason: String(jsonResponse.analysis.reason || ''),
            opportunity: String(jsonResponse.analysis.opportunity || ''),
            threat: String(jsonResponse.analysis.threat || ''),
            consumptionAndIssues: String(jsonResponse.analysis.consumptionAndIssues || ''),
            conclusion: String(jsonResponse.analysis.conclusion || ''),
        };
        
        const keywordLength = safeKeyword.length;
        const wordCount = safeKeyword.split(/\s+/).filter(Boolean).length;
        
        return {
            keyword: safeKeyword,
            opportunityScore: jsonResponse.opportunityScore || 0,
            searchVolumeEstimate: jsonResponse.searchVolumeEstimate || 0,
            competitionScore: jsonResponse.competitionScore || 0,
            competitionLevel: jsonResponse.competitionLevel || "N/A",
            documentCount: jsonResponse.documentCount || 0,
            analysis: cleanAnalysis,
            keywordLength,
            wordCount
        };

    } catch (error) {
         if (error instanceof Error) {
            console.error("프롬프트 실행 중 Gemini API 호출 실패:", error);
            if (error.message.includes('JSON')) {
                 throw new Error(`AI 모델이 프롬프트 결과를 처리하는 중 비정상적인 데이터를 반환했습니다. 다시 시도해주세요.`);
            }
            throw new Error(`프롬프트 실행 중 AI 모델과 통신하는 데 실패했습니다. 오류: ${error.message}`);
        } else {
            console.error("프롬프트 실행 중 알 수 없는 오류 발생:", error);
            throw new Error('프롬프트 실행 중 알 수 없는 오류가 발생했습니다.');
        }
    }
};


const callGenerativeModelForTopics = async (prompt: string): Promise<GeneratedTopic[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: '클릭률이 높은 블로그 포스팅 제목'
          },
          thumbnailCopy: {
            type: Type.STRING,
            description: '블로그 썸네일에 사용할 짧고 자극적인 문구'
          },
          strategy: {
            type: Type.STRING,
            description: '이 제목과 썸네일이 왜 효과적인지, 어떤 내용을 어떤 방식으로 담아야 상위 노출이 가능한지에 대한 구체적인 공략법'
          }
        },
        required: ['title', 'thumbnailCopy', 'strategy']
      }
    };
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            }
        });

        const parsed = JSON.parse(response.text.trim());

        if (!Array.isArray(parsed)) {
            throw new Error('AI 응답이 배열 형식이 아닙니다.');
        }

        return parsed.map((item, index) => ({
            id: index + 1,
            title: item.title,
            thumbnailCopy: item.thumbnailCopy,
            strategy: item.strategy,
        }));

    } catch (error) {
         if (error instanceof Error) {
            console.error("Gemini API 호출 중 오류 발생:", error);
            if (error.message.includes('JSON')) {
                 throw new Error(`AI 모델이 비정상적인 데이터를 반환했습니다. 다른 키워드로 다시 시도해주세요.`);
            }
            throw new Error(`블로그 주제 생성 중 AI 모델과 통신하는 데 실패했습니다. 오류: ${error.message}`);
        } else {
            console.error("알 수 없는 오류 발생:", error);
            throw new Error('블로그 주제 생성 중 알 수 없는 오류가 발생했습니다.');
        }
    }
};

export const generateTopicsFromMainKeyword = async (keyword: string): Promise<GeneratedTopic[]> => {
    if (!keyword.trim()) {
        throw new Error("키워드가 비어있습니다.");
    }
    const today = new Date();
    const formattedDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
    
    const prompt = `
당신은 검색 상위 노출과 높은 CTR(클릭률)을 유도하는 블로그 콘텐츠 제작 전문가입니다.
**분석 기준일: ${formattedDate}**
사용자가 검색할 키워드는 "${keyword}" 입니다.
이 키워드로 검색했을 때, 사용자의 시선을 사로잡아 클릭을 유도할 수 있는, 창의적이고 매력적인 블로그 제목, 그에 맞는 짧은 썸네일 문구, 그리고 각 주제에 대한 구체적인 공략법(어떤 내용을 어떤 방식으로 담아야 하는지)을 10개 제안해주세요.
특히, 제안하는 주제 중 일부는 최신 트렌드나 뉴스를 반영하여 시의성 높은 콘텐츠가 될 수 있도록 해주세요.
응답은 반드시 JSON 형식이어야 하며, 다른 설명 없이 JSON 코드 블록 하나만으로 응답해주세요.
`.trim();

    return callGenerativeModelForTopics(prompt);
};

export const generateTopicsFromAllKeywords = async (mainKeyword: string, relatedKeywords: string[]): Promise<GeneratedTopic[]> => {
    if (!mainKeyword.trim()) {
        throw new Error("메인 키워드가 비어있습니다.");
    }
     const today = new Date();
    const formattedDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

    const prompt = `
당신은 검색 상위 노출과 높은 CTR(클릭률)을 유도하는 블로그 콘텐츠 제작 전문가입니다.
**분석 기준일: ${formattedDate}**
메인 키워드는 "${mainKeyword}" 이고, 이와 관련된 자동완성검색어는 [${relatedKeywords.join(', ')}] 입니다.
이 키워드 조합들을 종합적으로 분석하여, 사용자의 다양한 검색 의도를 충족시키고 클릭을 유도할 수 있는, 창의적이고 매력적인 블로그 제목, 그에 맞는 짧은 썸네일 문구, 그리고 각 주제에 대한 구체적인 공략법(어떤 내용을 어떤 방식으로 담아야 하는지)을 10개 제안해주세요.
특히, 제안하는 주제 중 일부는 최신 트렌드나 뉴스를 반영하여 시의성 높은 콘텐츠가 될 수 있도록 해주세요.
응답은 반드시 JSON 형식이어야 하며, 다른 설명 없이 JSON 코드 블록 하나만으로 응답해주세요.
`.trim();

    return callGenerativeModelForTopics(prompt);
};

export const generateBlogStrategy = async (keyword: string, posts: BlogPostData[]): Promise<BlogStrategyReportData> => {
    if (!keyword.trim()) throw new Error("분석할 키워드가 없습니다.");
    if (!posts || posts.length === 0) throw new Error("분석할 블로그 포스트 데이터가 없습니다.");

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const today = new Date();
    const formattedDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

    const topTitles = posts.map((p, i) => `${i + 1}. ${p.title}`).join('\n');

    const prompt = `
당신은 10년차 SEO 전문가이자, 사용자의 클릭을 유도하는 콘텐츠 마케팅 전문가입니다.

**분석 기준일: ${formattedDate}**

다음은 '${keyword}' 키워드로 검색했을 때 상위 10개에 노출된 블로그 포스팅 제목 목록입니다.

[상위 10개 블로그 제목]
${topTitles}

[지시사항]
1.  **상위 제목 분석**: 특히 상위 1~3위 제목에 집중하여, 이들의 **구조적 특징**, **감성적 특징 및 소구점**, 그리고 **공통적으로 포함된 핵심 단어**를 분석해 주세요. 분석 내용은 전문가적이고 매우 구체적이어야 합니다.
2.  **새로운 전략 제안**: 위 분석을 바탕으로, 기존 상위 포스팅들을 이기고 검색 결과 1위를 차지할 수 있는, 훨씬 더 매력적이고 클릭률이 높은 **블로그 제목, 썸네일 문구, 그리고 구체적인 공략법**을 10개 제안해 주세요.

아래 JSON 형식에 맞춰 **JSON 코드 블록 하나만으로** 응답해 주세요. 다른 설명은 절대 추가하지 마세요.
`.trim();

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            analysis: {
                type: Type.OBJECT,
                properties: {
                    structure: { type: Type.STRING, description: "상위 제목들의 구조적 특징 분석 (예: 숫자 활용, 질문형, 특정 패턴 등)" },
                    characteristics: { type: Type.STRING, description: "독자의 어떤 감정이나 니즈를 자극하는지에 대한 분석 (예: 호기심 자극, 정보 제공 약속, 문제 해결 제시 등)" },
                    commonKeywords: { type: Type.STRING, description: "공통적으로 발견되는 핵심 단어 및 그 이유 분석" }
                },
                required: ['structure', 'characteristics', 'commonKeywords']
            },
            suggestions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING, description: "새로운 블로그 제목" },
                        thumbnailCopy: { type: Type.STRING, description: "썸네일에 사용할 짧고 강력한 문구" },
                        strategy: { type: Type.STRING, description: "이 제목과 썸네일이 왜 효과적인지, 어떤 내용을 어떤 방식으로 담아야 상위 노출이 가능한지에 대한 구체적인 공략법" }
                    },
                    required: ['title', 'thumbnailCopy', 'strategy']
                }
            }
        },
        required: ['analysis', 'suggestions']
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            }
        });

        const parsed = JSON.parse(response.text.trim());
        
        parsed.suggestions = parsed.suggestions.map((item: any, index: number) => ({ ...item, id: index + 1 }));

        if (!parsed.analysis || !Array.isArray(parsed.suggestions)) {
             throw new Error('AI 응답이 유효한 형식이 아닙니다.');
        }
        
        return parsed as BlogStrategyReportData;

    } catch (error) {
        if (error instanceof Error) {
            console.error("Gemini API 호출 중 오류 발생:", error);
            if (error.message.includes('JSON')) {
                 throw new Error(`AI 모델이 비정상적인 데이터를 반환했습니다. 다른 키워드로 다시 시도해주세요.`);
            }
            throw new Error(`블로그 공략법 생성 중 AI 모델과 통신하는 데 실패했습니다. 오류: ${error.message}`);
        } else {
            console.error("알 수 없는 오류 발생:", error);
            throw new Error('블로그 공략법 생성 중 알 수 없는 오류가 발생했습니다.');
        }
    }
};

export const generateSerpStrategy = async (keyword: string, serpData: GoogleSerpData): Promise<SerpStrategyReportData> => {
    if (!keyword.trim()) throw new Error("분석할 키워드가 없습니다.");
    if (!serpData) throw new Error("분석할 SERP 데이터가 없습니다.");

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const today = new Date();
    const formattedDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

    const relatedSearchesText = serpData.related_searches.length > 0 ? serpData.related_searches.join(', ') : 'N/A';
    const paaText = serpData.people_also_ask.length > 0 
        ? serpData.people_also_ask.map(p => `
          - 질문: ${p.question}
          - 콘텐츠 갭 (공략 포인트): ${p.content_gap_analysis}`).join('')
        : 'N/A';

    const prompt = `
당신은 15년차 SEO 전략가이자 콘텐츠 마케팅의 대가입니다. 당신의 임무는 경쟁자들이 놓치고 있는 '콘텐츠 갭'을 정확히 파고들어 검색 결과 1위를 차지하는 완벽한 전략을 수립하는 것입니다.

**분석 기준일: ${formattedDate}**

주어진 검색 키워드와 실제 Google 검색 결과 페이지(SERP) 데이터를 깊이 있게 분석하여, 사용자의 숨겨진 의도를 파악하고 경쟁을 압도할 콘텐츠 전략을 수립해야 합니다.

[분석 데이터]
- 검색 키워드: "${keyword}"
- 관련 검색어 (사용자들이 다음에 검색할 가능성이 높은 키워드): ${relatedSearchesText}
- 다른 사람들이 함께 찾는 질문 (PAA) 및 콘텐츠 갭 분석:
${paaText}

[매우 중요한 지시사항]
1.  **사용자 의도 및 콘텐츠 갭 분석**: 위 데이터를 종합하여, 사용자들이 '${keyword}'를 검색하는 진짜 이유와, 특히 PAA의 '콘텐츠 갭 (공략 포인트)'에서 드러난 **기존 콘텐츠들의 결정적인 약점**이 무엇인지 1~2문장으로 명확하게 정의해 주세요.
2.  **필러 포스트 제안**: 분석한 사용자 의도와 **콘텐츠 갭을 완벽하게 해결**하고, 관련 검색어와 PAA 질문 대부분을 포괄할 수 있는 **하나의 종합적인 '필러 포스트(Pillar Post)' 주제**를 제안해 주세요.
3.  **세부 블로그 주제 제안**: **(가장 중요)** 제안하는 10개의 블로그 주제는 반드시 위에서 분석된 **'콘텐츠 갭 (공략 포인트)'을 직접적으로 해결하는 내용**이어야 합니다. 각 주제가 어떤 갭을 어떻게 메우는지 명확히 드러나도록 구체적인 제목, 썸네일 문구, 공략법을 제안해 주세요.

아래 JSON 형식에 맞춰 **JSON 코드 블록 하나만으로** 응답해 주세요. 다른 설명은 절대 추가하지 마세요.
`.trim();

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            analysis: {
                type: Type.OBJECT,
                properties: {
                    userIntent: { type: Type.STRING, description: "데이터 기반으로 분석한 핵심 사용자 의도 및 콘텐츠 갭 요약 (1-2 문장)" },
                    pillarPostSuggestion: { type: Type.STRING, description: "모든 주제와 콘텐츠 갭을 아우를 수 있는 필러 포스트 주제 제안" },
                },
                required: ['userIntent', 'pillarPostSuggestion']
            },
            suggestions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING, description: "콘텐츠 갭을 해결하는 새로운 블로그 제목" },
                        thumbnailCopy: { type: Type.STRING, description: "썸네일에 사용할 짧고 강력한 문구" },
                        strategy: { type: Type.STRING, description: "이 제목과 썸네일이 왜 효과적인지, 어떤 '콘텐츠 갭'을 어떻게 해결하는지에 대한 구체적인 공략법" }
                    },
                    required: ['title', 'thumbnailCopy', 'strategy']
                }
            }
        },
        required: ['analysis', 'suggestions']
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            }
        });

        const parsed = JSON.parse(response.text.trim());
        
        parsed.suggestions = parsed.suggestions.map((item: any, index: number) => ({ ...item, id: index + 1 }));

        if (!parsed.analysis || !Array.isArray(parsed.suggestions)) {
             throw new Error('AI 응답이 유효한 형식이 아닙니다.');
        }
        
        return parsed as SerpStrategyReportData;

    } catch (error) {
        if (error instanceof Error) {
            console.error("Gemini API 호출 중 오류 발생:", error);
            if (error.message.includes('JSON')) {
                 throw new Error(`AI 모델이 비정상적인 데이터를 반환했습니다. 다른 키워드로 다시 시도해주세요.`);
            }
            throw new Error(`SERP 전략 생성 중 AI 모델과 통신하는 데 실패했습니다. 오류: ${error.message}`);
        } else {
            console.error("알 수 없는 오류 발생:", error);
            throw new Error('SERP 전략 생성 중 알 수 없는 오류가 발생했습니다.');
        }
    }
};


export const fetchRecommendedKeywords = async (): Promise<RecommendedKeyword[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const today = new Date();
    const formattedDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

    const prompt = `
    [페르소나 설정]
    - 당신은 대한민국 최고의 실시간 트렌드 분석가이자 SEO 전략가입니다.
    - 당신의 가장 중요한 임무는 '과거의 트렌드'가 아닌, '바로 오늘'의 가장 뜨거운 이슈를 발굴하는 것입니다.

    [매우 중요한 지시사항]
    - **분석 기준일: ${formattedDate}**
    - 모든 분석과 키워드 제안은 **반드시 오늘(${formattedDate}) 날짜를 기준으로, 최근 24시간 이내에 발생했거나 오늘부터 효력이 발생하는 가장 새로운 정보**에 근거해야 합니다. 절대 며칠 전의 이슈를 재활용해서는 안 됩니다.

    [작업 목표]
    Google 검색을 활용하여, 위 지시사항에 따라 검색량은 폭증하고 있으나 아직 양질의 콘텐츠가 부족한(경쟁 강도 낮음) 키워드 **총 10개**를 발굴하고, 아래 JSON 형식에 맞춰 완벽한 블로그 공략법을 제안하세요.

    [조건]
    1.  **정책/제도 키워드 (정확히 5개)**: **오늘(${formattedDate})부터 실제 시행되거나, 오늘 발표된 새로운 정책/제도** 관련 키워드여야 합니다.
    2.  **일반 최신 이슈 키워드 (정확히 5개)**: 정책/제도 외의 분야에서 **바로 오늘 가장 새롭게 떠오른 사회, 문화, 기술 등의 이슈** 관련 키워드여야 합니다.
    3.  **'선정 이유(reason)' 항목 작성 시**: 왜 이 키워드가 **'바로 오늘'** 중요한지, 시의성을 반드시 명확하게 설명해야 합니다.

    [JSON 출력 형식]
    - 아래 항목을 포함하여, 다른 설명 없이 JSON 코드 블록 하나만으로 응답하세요.

    [
      {
        "keyword": "발굴한 전략 키워드 1",
        "reason": "오늘(${formattedDate}) 이 키워드가 왜 중요한지에 대한 시의성 중심의 설명.",
        "title": "블로그 제목 1",
        "thumbnailCopy": "썸네일 문구 1",
        "strategy": "공략법 1"
      },
      {
        "keyword": "발굴한 전략 키워드 2",
        "reason": "선정 이유 2",
        "title": "블로그 제목 2",
        "thumbnailCopy": "썸네일 문구 2",
        "strategy": "공략법 2"
      }
    ]
    `.trim();

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        const parsed = extractJsonFromText(response.text);

        if (!Array.isArray(parsed)) {
            throw new Error('AI 응답이 배열 형식이 아닙니다.');
        }
        
        const citationRegex = /\[\d+(, ?\d+)*\]/g;

        return parsed.map((item, index) => {
            if (typeof item !== 'object' || item === null) return null;
            
            return {
                id: index + 1,
                keyword: (item.keyword || '').replace(citationRegex, '').trim(),
                reason: (item.reason || '').replace(citationRegex, '').trim(),
                title: (item.title || '').replace(citationRegex, '').trim(),
                thumbnailCopy: (item.thumbnailCopy || '').replace(citationRegex, '').trim(),
                strategy: (item.strategy || '').replace(citationRegex, '').trim(),
            };
        }).filter((item): item is RecommendedKeyword => item !== null);


    } catch (error) {
         if (error instanceof Error) {
            console.error("Gemini API 호출 중 오류 발생:", error);
            if (error.message.includes('JSON')) {
                 throw new Error(`AI 모델이 비정상적인 데이터를 반환했습니다. 다시 시도해주세요.`);
            }
            throw new Error(`전략 키워드 분석 중 AI 모델과 통신하는 데 실패했습니다. 오류: ${error.message}`);
        } else {
            console.error("알 수 없는 오류 발생:", error);
            throw new Error('전략 키워드 분석 중 알 수 없는 오류가 발생했습니다.');
        }
    }
};

export const generateSustainableTopics = async (keyword: string): Promise<SustainableTopicCategory[]> => {
    if (!keyword.trim()) {
        throw new Error("주제를 생성할 키워드가 비어있습니다.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const today = new Date();
    const formattedDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

    let prompt = `
당신은 15년차 SEO 전략가이자 콘텐츠 마케팅 전문가입니다. 당신의 임무는 일시적인 이슈성 키워드를 지속 가능한 콘텐츠 자산으로 바꾸는 것입니다.

**분석 기준일: ${formattedDate}**
사용자가 입력한 키워드: "${keyword}"

아래의 '이슈성 키워드를 지속적으로 유지하기 위한 방법론'과 '결과 예시'를 **완벽하게 숙지하고**, 그에 따라 위 키워드를 분석하여 블로그 주제 아이디어를 생성해 주세요. 결과는 반드시 '결과물 출력방식'과 '결과 예시'의 형식을 따라야 합니다.

---

# 이슈성 키워드를 지속적으로 유지하기 위한 방법론

이슈성 키워드는 사람들이 특정 사건이나 주제에 관심을 가지는 시기에 검색이 집중되며, 시간이 지남에 따라 검색량이 감소하는 특성이 있습니다. 이를 극복하고 **지속 가능한 관심**을 유지하기 위해서는 "주체"와 "검색 패턴"을 중심으로 전략적으로 접근해야 합니다. 아래는 이를 효과적으로 실행하기 위한 최종적인 방법론입니다.

---

## 1. **주체는 "관심과 감정이 연결된 대상"**

사람들이 검색을 할 때 중요한 것은 그 이슈와 연결된 **구체적인 대상**입니다. 이 대상은 사람들의 감정과 실질적 관심을 유발하는 주체여야 합니다.

### 실행 방안:
1. **개인적 주체 식별**: 사람들이 개인적으로 연관성을 느낄 수 있는 키워드를 설계합니다.
   - 예: 단순히 "폭설"이 아니라 "서울 폭설 대처법", "내 차를 위한 폭설 대비 방법"처럼 구체적인 상황과 연결.

2. **사회적 주체 확장**: 해당 이슈가 사회 전체에 미치는 영향을 강조합니다.
   - 예: "기후 변화와 폭설 빈도의 연관성", "도시 설계와 폭설 취약성 분석".

3. **구조적 질문 활용**:
   - 왜 이 일이 발생했는가? (원인)
   - 누가 영향을 받는가? (대상)
   - 어디에서 영향을 미치는가? (지역 및 환경)

---

## 2. **사람들의 검색 패턴 이해**

검색은 일반적으로 두 가지 경로로 이루어집니다: **즉각적인 호기심 충족**과 **구체적인 문제 해결**. 이 두 가지를 중심으로 키워드를 설계해야 합니다.

### 검색 패턴 분석:
1. **즉각적인 호기심**: "지금 무슨 일이야?"라는 질문에 대한 답을 찾기 위한 검색.
   - 관련 키워드: "OO 사건", "OO 뉴스", "OO 논란".

2. **구체적인 문제 해결**: "내가 지금 이 문제를 어떻게 해결하지?"라는 검색 니즈.
   - 관련 키워드: "OO 대처법", "OO 해결책", "OO 후기".

3. **장기적 관심 유도**: 사람들이 이슈가 지나간 후에도 검색할 수 있는 패턴을 만듭니다.
   - 예: "{YYYY+1}년 폭설 대응 전략", "다가오는 여름 기후 변화 예측".

---

## 3. **검색 패턴에 맞춘 지속 가능 키워드 설계**

사람들이 한 번 검색하고 끝내지 않도록 다음 요소들을 활용합니다:

### 1) **트렌드와 연결**
   - 사회적 이슈나 트렌드와 주제를 결합합니다.
   - 예: "{YYYY+1}년 폭설 트렌드", "다가오는 기후 변화와 우리의 미래".

### 2) **정보의 깊이 강화**
   - 단순 정보가 아닌, 다시 참고하고 싶은 유용한 콘텐츠로 유도합니다.
   - 예: "폭설의 원인과 기후 변화의 관계", "폭설 피해를 줄이는 도시 설계 방법".

### 3) **연관 키워드 확장**
   - 유사 검색어와 연계해 **중첩 검색어**를 만듭니다.
   - 예: "폭설 → 폭설 대처법 → 폭설 예보 확인 → 폭설 차량 준비".

---

## 4. **지속적으로 검색되도록 만드는 방법**

### 1) **사회적 논의와 연결**
   - 논란이나 토론 주제를 포함해 꾸준히 관심을 유도합니다.
   - 예: "도시 교통과 폭설 관리의 딜레마", "기후 변화 논란의 중심".

### 2) **사용자 참여 유도**
   - 사람들이 질문하거나 의견을 남기도록 유도합니다.
   - 예: "당신은 폭설 대처에 대해 어떻게 생각하시나요?", "다른 사람들의 폭설 경험은 어떨까요?".

### 3) **계절성과 반복성 활용**
   - 주기적으로 검색할 수 있는 이벤트와 연결합니다.
   - 예: "매년 초 겨울 폭설 대책", "여름철 폭염 대비 가이드".

---

## 5. **롱런 가능한 키워드 설계 전략**

### 핵심 전략:
1. **이슈의 구조적 분석**:
   - 단기적 관심에 머무르지 않고, 이슈의 근본 원인과 구조적 맥락을 파악합니다.
   - 예: "폭설의 사회적 영향과 기후 변화".

2. **반복 가능한 패턴 활용**:
   - 계절적, 주기적, 사회적 패턴과 연결.
   - 예: "{YYYY}년 겨울 폭설 예상", "다가오는 기후 변화의 미래".

3. **이슈 뒤에 숨겨진 메시지 강화**:
   - 단순 나열식 정보가 아닌, 장기적 시사점을 담습니다.
   - 예: "폭설이 주는 교훈: 지속 가능한 도시 설계의 필요성".

4. **매력적인 제목 설계**:
   - 의문과 탐구를 유도하는 방식으로 제목을 작성합니다.
   - 나쁜 예: "폭설 피해 뉴스".
   - 좋은 예: "서울은 왜 폭설에 취약할까?", "폭설 대처가 실패한 이유는?".

---

## 최종 결론

### 이슈성 키워드를 롱런하게 만드는 핵심 원칙:
1. **사람들의 관심과 감정이 연결된 주체를 찾아라.**
2. **즉각적인 호기심과 구체적인 문제 해결 패턴을 분석하라.**
3. **트렌드, 정보의 깊이, 연관 키워드를 활용해 지속 가능한 검색 환경을 조성하라.**
4. **장기적 시사점을 제공하고, 반복 검색 가능한 구조를 설계하라.**

### 결과물 출력방식
 -  "즉각적인 호기심 유발",  "구체적인 문제 해결",  "장기적인 관심 유도", "사회적 주제와 연결 " 등과 같은 용도별 카테고리로 분류하고 카테고리별 10개의 제목을 제안
- 제목별로 해당기사에 반드시 포함해야 할 (핵심키워드를 5개)
- 제목별로 seo요건에 맞춰 (구글검색 상위 노출을 위한 글쓰기 전략)을 포함합니다.

이 전략을 통해 이슈성 키워드를 단순 유행이 아닌 **지속 가능한 관심사**로 전환할 수 있습니다.

## ---결과 예시 ---

아래는 키워드 [반려동물]로 구성한 블로그 제목 제안입니다.
목표는 *지속적인 검색*, *트렌드 대응*, *문제 해결*, *사회적 연결성*을 고려해 설계했습니다.

---

## 1. 즉각적인 호기심 유발

### 사람들이 궁금해하고 바로 클릭할만한 주제

| 블로그 제목                           | 핵심 키워드                       | 구글 SEO 글쓰기 전략                      |
| -------------------------------- | ---------------------------- | ---------------------------------- |
| 반려동물 키우면 진짜 장수할까? 과학적 근거 총정리     | 반려동물, 장수, 건강효과, 심리치유, 과학적연구  | 질문형 제목 → 서두에 연구결과 제시 → 하단 관련 논문 인용 |
| 강아지보다 고양이가 더 오래 사는 이유            | 반려동물, 수명비교, 강아지, 고양이, 평균수명   | 검색패턴 활용 → 비교 포인트 강조 → 연관 검색어 삽입    |
| {YYYY+1} 반려동물 트렌드 TOP5, 이제 이런걸 키운다고? | 반려동물, 트렌드, 희귀펫, 인기반려동물, 키우기팁 | 리스트형 구성 → 최근 이슈 연결 → 사례 및 추천       |
| 반려동물 키울 때 몰라서 손해보는 지원금 총정리       | 반려동물, 지원금, 정부정책, 혜택, 펫보험     | 정보성 콘텐츠 → 최신 정보 업데이트 → 신청 방법 강조    |
| 고양이가 집사를 진짜 좋아할 때 보이는 행동 7가지     | 반려동물, 고양이, 애정표현, 행동특징, 습관    | 숫자형 리스트 → 사례와 사진 활용 → 검색최적화        |

---

## 2. 구체적인 문제 해결

### 사람들이 실생활에서 바로 찾을만한 키워드

| 블로그 제목                       | 핵심 키워드                    | 구글 SEO 글쓰기 전략                |
| ---------------------------- | ------------------------- | ---------------------------- |
| 강아지가 사료를 안 먹어요? 원인과 해결방법 총정리 | 반려동물, 강아지, 사료거부, 해결방법, 건강 | 원인별 구분 → 해결방법 서술 → 전문가 조언 첨부 |
| 반려동물 이사 스트레스 줄이는 5가지 방법      | 반려동물, 이사, 스트레스, 적응, 준비방법  | 상황별 대응법 → 체크리스트 제공 → 링크 삽입   |
| 강아지 입양 전 꼭 확인해야 할 체크리스트      | 반려동물, 강아지입양, 준비물, 비용, 절차  | 체크리스트 제공 → 다운로드 가능 → 후속글 연결  |
| 반려동물 여행 갈 때 필수 준비물 리스트       | 반려동물, 여행, 준비물, 펫호텔, 이동가방  | 리스트형 → 제품추천 → 경험리뷰           |
| 고양이 모래 추천! 상황별 베스트 5 비교      | 반려동물, 고양이, 모래추천, 제품비교, 가격 | 비교리뷰형 → 장단점 표기 → 가격정보 포함     |

---

## 3. 장기적인 관심 유도

### 시간이 지나도 계속 검색되는 키워드 설계

| 블로그 제목                       | 핵심 키워드                       | 구글 SEO 글쓰기 전략               |
| ---------------------------- | ---------------------------- | --------------------------- |
| 반려동물과 오래 사는 집의 공통점 5가지       | 반려동물, 장수비결, 생활습관, 건강관리, 실내환경 | 생활습관 제안 → 실천가이드 → 연결포스팅 유도  |
| 반려동물도 치매 걸린다? 증상과 예방법        | 반려동물, 치매, 증상, 예방법, 인지장애      | 증상 소개 → 예방법 설명 → 전문가 조언     |
| 1인가구 반려동물 키우기, 현실 가이드        | 반려동물, 1인가구, 키우기방법, 장단점, 비용   | 현실적 문제 제기 → 해결팁 제공 → 후속링크   |
| 반려동물 장례문화, 미리 알아두면 좋은 것들     | 반려동물, 장례, 추모, 절차, 비용         | 절차설명 → 비용가이드 → 장례업체 추천      |
| 반려동물 보험, 진짜 필요할까? 가입 전 체크리스트 | 반려동물, 보험, 필요성, 비교, 체크리스트     | 정보성 구성 → 보험사 비교 → 후속 콘텐츠 유도 |

---

## 4. 사회적 주제와 연결

### 사회적 가치, 이슈, 트렌드를 담은 콘텐츠

| 블로그 제목                     | 핵심 키워드                      | 구글 SEO 글쓰기 전략              |
| -------------------------- | --------------------------- | -------------------------- |
| 반려동물 유기, 당신이 모르는 진짜 이유     | 반려동물, 유기, 이유, 보호소, 사회문제     | 감정 유도 서두 → 데이터 제시 → 대안 제시  |
| 반려동물 출생신고제, 왜 필요한가?        | 반려동물, 출생신고, 법제화, 제도, 사회적 이슈 | 배경 설명 → 제도 현황 → 찬반 의견 정리   |
| 펫테크 시대, 반려동물 케어는 어떻게 달라질까? | 반려동물, 펫테크, 스마트기기, 미래트렌드, AI | 미래예측형 → 신제품 소개 → 사례연결      |
| 펫푸드 원산지 논란, 소비자가 꼭 알아야 할 것 | 반려동물, 펫푸드, 원산지, 논란, 정보      | 문제제기 → 안전기준 → 추천제품         |
| 반려동물 돌봄 노동, 누가 책임지나?       | 반려동물, 돌봄노동, 사회문제, 가사노동, 책임  | 사회적 관점 분석 → 전문가 의견 → 토론 유도 |

---

다른 설명 없이, **JSON 코드 블록 하나만으로** 응답해주세요.
`.trim();

    const currentYear = new Date().getFullYear();
    prompt = prompt.replace(/{YYYY}/g, String(currentYear));
    prompt = prompt.replace(/{YYYY\+1}/g, String(currentYear + 1));

    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                category: { type: Type.STRING },
                suggestions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            keywords: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                            },
                            strategy: { type: Type.STRING }
                        },
                        required: ['title', 'keywords', 'strategy']
                    }
                }
            },
            required: ['category', 'suggestions']
        }
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            }
        });

        const parsed = JSON.parse(response.text.trim());

        if (!Array.isArray(parsed) || parsed.some(p => !p.category || !Array.isArray(p.suggestions))) {
            throw new Error('AI 응답이 유효한 형식이 아닙니다.');
        }

        return parsed as SustainableTopicCategory[];
    } catch (error) {
        if (error instanceof Error) {
            console.error("Gemini API 호출 중 오류 발생:", error);
            if (error.message.includes('JSON')) {
                throw new Error(`AI 모델이 비정상적인 데이터를 반환했습니다. 다른 키워드로 다시 시도해주세요.`);
            }
            throw new Error(`지속 가능 주제 생성 중 AI 모델과 통신하는 데 실패했습니다. 오류: ${error.message}`);
        } else {
            console.error("알 수 없는 오류 발생:", error);
            throw new Error('지속 가능 주제 생성 중 알 수 없는 오류가 발생했습니다.');
        }
    }
};

export const fetchCurrentWeather = async (): Promise<WeatherData> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
    오늘 서울의 현재 날씨를 Google 검색을 사용해서 알려주세요. 
    온도, 날씨 상태(예: 맑음, 구름 많음), 풍속, 습도를 포함해야 합니다. 
    다른 설명 없이 JSON 코드 블록 형식으로만 응답해주세요.
    
    \`\`\`json
    {
        "temperature": "...",
        "condition": "...",
        "wind": "...",
        "humidity": "..."
    }
    \`\`\`
    `.trim();

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });
        const parsed = extractJsonFromText(response.text);
        if (parsed.temperature && parsed.condition && parsed.wind && parsed.humidity) {
            return parsed as WeatherData;
        } else {
            throw new Error('AI 응답이 날씨 데이터 형식이 아닙니다.');
        }
    } catch (error) {
        console.error("날씨 정보 조회 중 Gemini API 오류:", error);
        if (error instanceof Error) {
            throw new Error(`실시간 날씨 정보를 가져오는 데 실패했습니다: ${error.message}`);
        }
        throw new Error("실시간 날씨 정보를 가져오는 데 실패했습니다.");
    }
};