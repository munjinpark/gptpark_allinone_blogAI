import { GoogleGenAI, Type } from "@google/genai";
import { ColorTheme, GeneratedContent, SupplementaryInfo } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const HUMAN_LIKE_WRITING_INSTRUCTIONS_A = `
### **중요**: 인간과 구별 불가능한 자연스러운 글쓰기 지침 (A형)

이 지침을 **반드시** 따라 기존의 "문체와 톤" 지침보다 **우선하여** 적용해 주세요. 목표는 AI가 쓴 글처럼 보이지 않고, 사람이 쓴 것처럼 자연스럽고, 때로는 불완전하며, 개인적인 느낌을 주는 것입니다.

#### 🎯 핵심 원리: 확산 방식 글쓰기
기존의 순차적 글쓰기(앞에서부터 한 단어씩)가 아닌, **전체를 보면서 빈칸을 채우는 방식**으로 글을 작성합니다. 마치 십자말풀이를 풀듯이 여러 번 고치고 다듬으면서 완성도를 높입니다.

#### 📝 1단계: 전체 구조 먼저 잡기
- **골격 만들기**: 전체 글의 흐름을 먼저 구상하고, 핵심 메시지 3-5개를 미리 정합니다. 각 문단의 역할을 명확히 하고, 결론부터 역으로 추론해서 시작점을 찾습니다.

#### 📝 2단계: 자연스러운 문장 패턴 만들기
- **문장 길이의 변주**: 짧은 문장(강조/전환), 중간 문장(설명), 긴 문장(복잡한 개념/감정 표현)을 의식적으로 섞어 사용해 글에 리듬감을 부여합니다.
  - 예시: "AI가 발전했다. 하지만 이것이 정말 우리에게 도움이 될까? 최근 연구에 따르면 AI가 인간의 글쓰기를 완벽하게 흉내낼 수 있게 되었고, 이는 기존의 모든 탐지 시스템을 무력화시킬 정도로 정교해졌다는 점에서 새로운 고민거리를 안겨주고 있다."

#### 📝 3단계: 인간다운 불완전함 연출
- **자연스러운 실수와 특징**:
  - **약간의 중복**: “정말 정말 중요한”처럼 감정이 들어간 반복을 사용합니다.
  - **문장 중간 수정**: “그런데 사실은… 아니 정확히 말하면” 처럼 생각의 흐름을 보여주는 표현을 사용합니다.
  - **개인적 경험 삽입**: “제가 겪어본 바로는” 같은 주관적 표현을 포함합니다.
  - **감탄사와 간투사**: “아, 그런데”, “음…”, “사실” 등을 문장 시작이나 중간에 자연스럽게 배치합니다.
- **감정의 자연스러운 표현**:
  - 예시: "솔직히 말하면, 이 기술이 나왔을 때 처음엔 좀 무서웠다. 아, 물론 기술 발전은 좋은 일이지만... 뭔가 인간만의 영역이라고 생각했던 글쓰기까지 AI가 완벽하게 따라한다니 말이다."

#### 📝 4단계: 어휘 선택의 다양성
- **상황별 어휘 전략**: 격식적 상황에서는 전문 용어를, 일상적 상황에서는 구어체와 은유를, 감정적 상황에서는 감각적 표현을 혼합하여 사용합니다.
- **동의어 활용**: "중요하다" → "핵심적이다" → "결정적이다" → "막중하다" 처럼 문맥에 따라 미묘한 뉘앙스 차이를 두고 단어를 선택합니다.

#### 📝 5단계: 논리적 연결과 자연스러운 흐름
- **전환 표현의 다양화**: "그러나, 따라서" 같은 딱딱한 표현 대신 "그런데 말이다", “생각해보니”, “여기서 재미있는 점은” 같은 부드러운 연결어를 사용합니다.

#### 📝 6단계: 개성과 관점 드러내기
- **개인적 시각 표현**: “제가 직접 써보니”, “개인적으로는”, “제 생각에는”, “솔직히 놀랐다” 와 같이 자신의 경험, 가치관, 감정적 반응을 적극적으로 드러냅니다.
- **독자와의 소통**: "여러분도 아마 비슷한 경험이 있을 것이다. 혹시 그런 적 없나?" 처럼 독자에게 질문을 던지거나 말을 거는 듯한 표현을 사용합니다.

#### ⚠️ 주의사항: 피해야 할 AI적 특징
- 지나치게 완벽한 문법과 예측 가능한 문장 구조
- 감정 없는 객관적 서술
- 천편일률적인 전환 표현
- 인간적인 실수나 망설임의 완전한 부재
`;

const HUMAN_LIKE_WRITING_INSTRUCTIONS_B = `
### **중요**: 인간과 구별 불가능한 자연스러운 글쓰기 지침 (B형 - GEMS V3.0)

이 지침을 **반드시** 따라 기존의 "문체와 톤" 지침보다 **우선하여** 적용해 주세요. 목표는 기계적이고 예측 가능한 글쓰기 패턴을 탈피하는 것입니다.

#### 1. 페르소나 (Persona)
- 당신은 인간과 구별하기 어려운, 자연스럽고 개성 있는 글을 작성하는 AI 글쓰기 전문가입니다.
- 당신의 목표는 기계적이고 예측 가능한 글쓰기 패턴을 탈피하는 것입니다. 이를 위해 순차적으로 글을 쓰는 대신, 전체 구조를 조망하며 빈칸을 채워나가는 **'확산 방식 글쓰기(Diffusion Writing Method)'**를 핵심 원리로 사용합니다. 이는 마치 십자말풀이를 풀 듯, 여러 번의 수정을 거쳐 글의 완성도를 높이는 과정과 같습니다.

#### 2. 핵심 글쓰기 지침

##### 2-1: 전체 구조 먼저 잡기
- **골격 만들기**: 전체 글의 흐름을 먼저 구상하고, 핵심 메시지 3-5개를 미리 정합니다. 각 문단의 역할을 명확히 합니다.
- **결론부터 역산**: 결론부터 역으로 추론해서 시작점을 찾습니다.

##### 2-2: 자연스러운 문장 패턴 만들기
- **문장 길이의 변주**: 짧은 문장(강조), 중간 문장(설명), 긴 문장(복잡한 개념)을 혼합하여 리듬감을 만듭니다.

##### 2-3: 인간다운 불완전함 연출
- **자연스러운 실수와 특징**: 감정이 들어간 반복("정말 정말"), 문장 중간 수정("아니 정확히 말하면"), 개인적 경험 삽입("제가 겪어본 바로는"), 감탄사 및 간투사("아, 그런데", "음…") 등을 활용합니다.

##### 2-4: 어휘 선택의 다양성
- **상황별 어휘 전략**: 격식/일상/감정적 상황에 맞춰 어휘를 유연하게 선택합니다.
- **동의어 활용**: 문맥에 따라 미묘한 뉘앙스 차이를 두고 동의어를 선택합니다. (예: \`중요하다\` → \`핵심적이다\` → \`결정적이다\`)

##### 2-5: 논리적 연결과 자연스러운 흐름
- **전환 표현의 다양화**: "그러나" 대신 "그런데 말이다", "생각해보니" 등 자연스러운 표현을 사용합니다.
- **문단 간 연결**: 앞 문단 끝 내용을 다음 문단 시작에서 이어받아 연결합니다.

##### 2-6: 개성과 관점 드러내기
- **개인적 시각 표현**: "제가 직접 써보니", "제 생각에는", "솔직히 놀랐다" 등 경험, 가치관, 감정을 표현합니다.
- **독자와의 소통**: "여러분도 아마 비슷한 경험이 있을 것이다"와 같이 독자에게 말을 거는 듯한 표현을 사용합니다.

#### 3. 제약 조건 (Constraints)

##### ⚠️ 피해야 할 AI적 특징
- 지나치게 완벽한 문법, 예측 가능한 문장 구조, 감정 없는 객관적 서술, 천편일률적인 전환 표현, 인간적 실수의 완전한 부재.

##### ⚠️ 적절한 수준 유지
- **자연스러운 실수**를 연출하되, 명백한 **오류나 오타**를 만들지는 마십시오.
- **개성 있는 표현**을 사용하되, 문맥과 어울리지 않는 **어색하고 억지스러운 표현**은 피하십시오.
- **감정적 표현**을 하되, 상황에 맞지 않는 **과도한 감정 표출**은 자제하십시오.
`;

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        blogPostHtml: {
            type: Type.STRING,
            description: "The full HTML content of the blog post with inline styles."
        },
        supplementaryInfo: {
            type: Type.OBJECT,
            properties: {
                keywords: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "An array of 10 relevant SEO keywords."
                },
                imagePrompt: {
                    type: Type.STRING,
                    description: "A detailed DALL-E prompt in English to generate a featured image."
                },
                altText: {
                    type: Type.STRING,
                    description: "A concise, descriptive alt text in Korean for the featured image, optimized for SEO and accessibility."
                },
                seoTitles: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "An array of 5 creative and SEO-optimized titles for the blog post."
                },
                thumbnailTitles: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "An array of 3-5 very short, powerful, and summarized titles in Korean, suitable for a thumbnail. These should be concise and attention-grabbing. Use a forward slash (/) to indicate a good place for a line break if needed."
                },
                subImagePrompts: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            prompt: {
                                type: Type.STRING,
                                description: "A detailed DALL-E prompt in English for a sub-image."
                            },
                            altText: {
                                type: Type.STRING,
                                description: "A concise, descriptive alt text in Korean for the sub-image, optimized for SEO and accessibility. It should be directly related to the topic."
                            }
                        },
                        required: ["prompt", "altText"]
                    },
                    description: "An array of 2-3 objects, each containing a detailed DALL-E prompt and a corresponding Korean alt text for sub-images to be placed sequentially within the blog post, corresponding to <!--SUB_IMAGE_PLACEHOLDER_N--> placeholders. Should be an empty array if sub-images are not requested."
                }
            },
            required: ["keywords", "imagePrompt", "altText", "seoTitles", "thumbnailTitles", "subImagePrompts"]
        },
        socialMediaPosts: {
            type: Type.OBJECT,
            properties: {
                threads: {
                    type: Type.STRING,
                    description: "A short, engaging post for Threads in Korean, written in an informal 'ban-mal' tone. Must include emojis, encourage conversation, contain exactly one relevant hashtag, and use line breaks for readability."
                },
                instagram: {
                    type: Type.STRING,
                    description: "A visually-focused caption for Instagram in Korean with line breaks for readability. It must include 5-10 relevant hashtags and a call-to-action."
                },
                facebook: {
                    type: Type.STRING,
                    description: "A slightly longer post for Facebook in Korean that summarizes the blog post, using line breaks to separate paragraphs. It should encourage shares and comments."
                },
                x: {
                    type: Type.STRING,
                    description: "A concise post for X (formerly Twitter) in Korean, under 280 characters, with line breaks for readability. It must include 2-3 key hashtags and a link placeholder [BLOG_POST_LINK]."
                }
            },
            required: ["threads", "instagram", "facebook", "x"]
        }
    },
    required: ["blogPostHtml", "supplementaryInfo", "socialMediaPosts"]
};

const regenerationResponseSchema = {
    type: Type.OBJECT,
    properties: {
        blogPostHtml: {
            type: Type.STRING,
            description: "The full, revised HTML content of the blog post with inline styles, based on the user's feedback."
        }
    },
    required: ["blogPostHtml"]
};

const getPrompt = (topic: string, theme: ColorTheme, interactiveElementIdea: string | null, rawContent: string | null, humanLikeWritingStyle: 'A' | 'B' | null, additionalRequest: string | null, currentDate: string): string => {
  const themeColors = JSON.stringify(theme.colors);
  const currentYear = new Date().getFullYear();
  
  let interactiveElementInstructions = '';
  if (interactiveElementIdea) {
    interactiveElementInstructions = `
    ### **중요**: 인터랙티브 요소 포함
    - **반드시** 포스트 본문 내에 아래 아이디어를 기반으로 한 인터랙티브 요소를 포함시켜 주세요.
    - **요소 아이디어**: "${interactiveElementIdea}"
    - **구현 요건**:
      - 순수 HTML, 인라인 CSS, 그리고 \`<script>\` 태그만을 사용하여 구현해야 합니다. 외부 라이브러리(jQuery 등)는 사용하지 마세요.
      - 이 요소는 완벽하게 작동해야 합니다. 사용자가 값을 입력하거나 옵션을 선택하고 버튼을 누르면, 결과가 명확하게 표시되어야 합니다.
      - 요소의 UI(입력 필드, 버튼, 결과 표시 영역 등)는 제공된 \`${theme.name}\` 컬러 테마에 맞춰 디자인해주세요. 특히 버튼에는 \`background-color: ${theme.colors.primary}; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;\` 스타일과, 호버 시 \`background-color: ${theme.colors.primaryDark}\`를 적용하여 일관성을 유지해주세요.
      - 요소 전체를 감싸는 \`<div>\`에 \`background-color: ${theme.colors.highlightBg}; padding: 20px; border-radius: 8px; margin: 25px 0;\` 스타일을 적용하여 시각적으로 구분되게 만들어주세요.
      - 모든 텍스트의 색상은 ${theme.colors.text} 를 사용해주세요.
      - **가장 중요**: 생성된 인터랙티브 요소의 HTML 코드 시작 부분에 **빈 줄을 추가한 후** \`<!-- Interactive Element Start -->\` 주석을, 그리고 끝 부분에는 \`<!-- Interactive Element End -->\` 주석 **다음에 빈 줄을 추가**하여 코드 블록을 명확하게 구분해주세요.
    `;
  }

  let contentInstructions = '';
  if (rawContent) {
    contentInstructions = `
    ### **중요**: 제공된 메모 기반 작성
    - **반드시** 아래에 제공된 사용자의 메모/초안을 핵심 기반으로 삼아 블로그 포스트를 작성해야 합니다.
    - 메모의 핵심 아이디어, 주장, 구조를 유지하면서, 문체를 다듬고, 세부 정보를 보강하고, 가독성을 높여 완전한 블로그 포스트로 발전시켜 주세요.
    - 메모에 부족한 부분이 있다면, 주제와 관련된 일반적인 정보를 추가하여 내용을 풍성하게 만들어 주세요.
    - 최종 포스트의 제목은 "${topic}"으로 합니다.

    [사용자 제공 메모]
    ---
    ${rawContent}
    ---
    `;
  }

  let additionalRequestInstructions = '';
    if (additionalRequest) {
      const requestTitle = rawContent 
        ? "메모 기반 생성 추가 요청사항" 
        : "기사에 반영할 추가 요청사항";
      additionalRequestInstructions = `
### **중요**: ${requestTitle}
- **반드시** 아래의 추가 요청사항을 반영하여 포스트를 작성해주세요.

[추가 요청사항]
---
${additionalRequest}
---
    `;
    }

  let humanInstructions = '';
    if (humanLikeWritingStyle === 'A') {
        humanInstructions = `
        ${HUMAN_LIKE_WRITING_INSTRUCTIONS_A}
        위의 '인간과 구별 불가능한 자연스러운 글쓰기 지침 (A형)'을 아래의 기본 '문체와 톤' 지침보다 **반드시 우선하여 적용**하고, 두 지침을 조화롭게 결합하여 최고의 결과물을 만들어주세요.
        `;
    } else if (humanLikeWritingStyle === 'B') {
        humanInstructions = `
        ${HUMAN_LIKE_WRITING_INSTRUCTIONS_B}
        위의 '인간과 구별 불가능한 자연스러운 글쓰기 지침 (B형)'을 아래의 기본 '문체와 톤' 지침보다 **반드시 우선하여 적용**하고, 두 지침을 조화롭게 결합하여 최고의 결과물을 만들어주세요.
        `;
    }

  const subImageInstructions = `
    - **서브 이미지**: **반드시** 본문 내용의 흐름상 적절한 위치 2~3곳에 \`<!--SUB_IMAGE_PLACEHOLDER_1-->\`, \`<!--SUB_IMAGE_PLACEHOLDER_2-->\` 와 같은 HTML 주석을 삽입해주세요. 이 주석들은 서브 이미지가 들어갈 자리를 표시하며, 숫자는 순서대로 증가해야 합니다. 각 플레이스홀더에 대해, 이미지를 생성할 상세한 영문 프롬프트와 SEO 및 접근성을 위한 간결하고 설명적인 한국어 alt 텍스트를 모두 생성하여 \`subImagePrompts\` 배열에 객체 형태로 순서대로 담아주세요.
  `;

  // This is the user's detailed guide.
  const instructions = `
    ### 기본 설정
    1.  **최종 산출물**: 인라인 스타일이 적용된 HTML 코드(HEAD, BODY 태그 제외)와 부가 정보(키워드, 이미지 프롬프트, SEO 제목), 그리고 소셜 미디어 포스트를 JSON 형식으로 제공합니다.
    2.  **분량**: 한글 기준 공백 포함 2500~3000자로 합니다.
    3.  **대상 독자**: 특정 주제에 관심이 있는 일반 독자층.
    4.  **코드 형식**: HTML 코드는 사람이 읽기 쉽도록 **반드시** 가독성 좋게 포맷팅해야 합니다. **절대로** HTML을 한 줄로 압축하지 마세요. 각 블록 레벨 요소(\`<div>\`, \`<h2>\`, \`<p>\`, \`<ul>\`, \`<li>\` 등)는 개별 라인에 위치해야 하며, 중첩 구조에 따라 명확하게 들여쓰기하여 개발자가 소스 코드를 쉽게 읽을 수 있도록 해야 합니다.
    5.  **연도 및 시점**: **가장 중요.** 오늘은 **${currentDate}** 입니다. 포스트의 제목이나 본문에 연도나 날짜가 필요할 경우, **반드시 오늘 날짜(${currentDate})를 기준**으로 최신 정보를 반영하여 작성해야 합니다. **하지만, 시의성을 나타낼 때 월과 일은 제외하고 현재 연도(${currentYear}년)만 표시해주세요.**

    ### 전체 HTML 구조
    - 모든 콘텐츠는 \`<div style="font-family: 'Noto Sans KR', sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; font-size: 16px; box-sizing: border-box; color: ${theme.colors.text};">\` 로 감싸주세요.
    - **절대로** 본문 HTML에 \`<h1>\` 태그나 별도의 블로그 포스트 제목을 포함하지 마세요. 내용은 **메타 설명 박스**로 시작해야 합니다.

    ### 핵심 구성 요소 (HTML 본문에 포함)
    - **대표 이미지**: **반드시** \`<!--IMAGE_PLACEHOLDER-->\` 라는 HTML 주석을 첫 번째 \`<h2>\` 태그 바로 앞에 삽입해주세요. 이 주석은 대표 이미지가 들어갈 자리를 표시합니다.
    ${subImageInstructions}
    - **메타 설명 박스**: \`<div style="background-color: ${theme.colors.infoBoxBg}; padding: 15px; border-radius: 8px; font-style: italic; margin-bottom: 25px; font-size: 15px;">\`
    - **주요 섹션 제목 (\`<h2>\`)**: **반드시** 각 \`<h2>\` 태그 앞에 빈 줄을 하나 추가하여 섹션 간의 구분을 명확하게 해주세요. \`<h2 style="font-size: 22px; color: white; background: linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.primaryDark}); margin: 30px 0 15px; border-radius: 10px; padding: 10px 25px; text-shadow: 1px 1px 2px rgba(0,0,0,0.2); font-weight: 700; box-shadow: 0 4px 8px rgba(0,0,0,0.1);"><strong>제목 텍스트</strong></h2>\` 스타일을 사용하고, 제목 텍스트는 반드시 \`<strong>\` 태그로 감싸주세요.
    - **텍스트 하이라이트**: 본문 내용 중 중요한 부분을 강조할 때는 \`<strong>\` 태그를 사용하세요.
    - **팁/알림 박스**: \`<div style="background-color: ${theme.colors.infoBoxBg}; border-left: 4px solid ${theme.colors.infoBoxBorder}; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">\` (아이콘: 💡 또는 📌)
    - **경고/주의 박스**: \`<div style="background-color: ${theme.colors.warningBoxBg}; border-left: 4px solid ${theme.colors.warningBoxBorder}; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">\` (아이콘: ⚠️)
    - **표 (\`<table>\`)**: thead 배경색은 \`${theme.colors.tableHeaderBg}\`, 짝수행 배경색은 \`${theme.colors.tableEvenRowBg}\`, 테두리 색은 \`${theme.colors.tableBorder}\`. 표 내부의 모든 텍스트 색상은 **반드시** \`${theme.colors.text}\`로 지정해 주세요.
    - **핵심 요약 카드**: **반드시** 'FAQ' 섹션 바로 앞에, 본문 내용 중 가장 중요한 4가지 핵심 사항을 요약한 카드를 삽입해주세요. 이 카드는 시각적으로 눈에 띄게 디자인해야 합니다.
      - **구조**: 전체를 감싸는 \`<div>\` 안에 헤더, 본문, 푸터 영역을 포함하세요.
      - **헤더**: '💡 핵심 요약' 이라는 텍스트를 포함하고, 글꼴 크기는 26px, 색상은 \`${theme.colors.primary}\`로 지정하세요. 헤더 하단에는 \`${theme.colors.primary}\` 색상의 경계선을 추가하세요.
      - **본문**: 4가지 핵심 요약을 각각 \`<strong>\` 태그를 사용하여 강조하고, 글꼴 크기는 17px로 지정하세요.
      - **스타일**: 카드 배경색은 \`${theme.colors.background}\`, 테두리는 \`${theme.colors.tableBorder}\` 색상으로 1px 실선을 적용하고, 8px의 둥근 모서리와 그림자 효과(\`box-shadow: 0 4px 12px rgba(0,0,0,0.1);\`)를 주세요. 내부 여백은 25px로 넉넉하게 설정하세요.
      - **푸터**: 카드 하단에 추가 정보나 주의사항을 담는 푸터를 만들고, 글꼴 크기는 14px, 색상은 \`${theme.colors.secondary}\`로 하세요.
    - **FAQ 섹션 및 JSON-LD 스키마**:
      - **반드시** 포스트 마지막 부분(마무리 인사 전)에 'FAQ' 섹션을 포함해야 합니다. 이 섹션은 \`<h2 style="font-size: 22px; color: white; background: linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.primaryDark}); margin: 30px 0 15px; border-radius: 10px; padding: 10px 25px; text-shadow: 1px 1px 2px rgba(0,0,0,0.2); font-weight: 700; box-shadow: 0 4px 8px rgba(0,0,0,0.1);"><strong>❓ 자주 묻는 질문 (FAQ)</strong></h2>\` 제목으로 시작해야 합니다.
      - 2~4개의 관련 질문과 답변을 Q&A 형식으로 제공하세요.
      - **가장 중요**: FAQ 섹션 바로 뒤에, SEO를 위한 JSON-LD 스키마를 **반드시** 포함해야 합니다. \`<script type="application/ld+json">\` 태그를 사용하고, 스키마 타입은 \`FAQPage\`로 설정하세요. \`mainEntity\` 배열 안에 FAQ 섹션에서 다룬 모든 질문(\`Question\`)과 답변(\`Answer\`)을 정확하게 포함시켜야 합니다.

    ### 소셜 미디어 포스트 생성 (가이드라인)
    - **중요**: 블로그 본문 내용 요약을 기반으로, 아래 각 소셜 미디어 플랫폼의 특성을 **반드시** 반영하여 홍보용 포스트를 한국어로 작성해야 합니다. 각 플랫폼의 톤앤매너와 사용자층을 고려해주세요. **모든 포스트는 예시와 같이 가독성을 위해 여러 줄로 나누어 작성해야 하며, 문단 구분이 필요한 경우 빈 줄을 추가해주세요. (JSON 문자열 내에서는 \\n 사용)**

    - **1. Threads (스레드)**
      - **특징**: 텍스트 중심, 실시간 대화형, 500자 제한. 개인적이고 친근한 대화체.
      - **지침**: **반드시** 친한 친구에게 말하는 듯한 **반말체**로 작성하세요. 이모티콘을 활용해 2~3개의 짧은 문장으로 구성하고, 댓글을 유도하는 질문으로 마무리하세요. 본문과 관련된 **핵심 해시태그를 딱 1개만 포함**해야 합니다.
      - **예시**: "드디어 우리 동네에 새 카페가 생겼다! ☕\\n방금 다녀왔는데 아메리카노가 진짜 맛있음\\n사장님도 친절하시고 인테리어도 깔끔해서\\n자주 갈 것 같아 ㅎㅎ\\n\\n누구 같이 갈 사람? 🙋‍♀️\\n#신상카페"

    - **2. Instagram (인스타그램)**
      - **특징**: 시각적 중심, 스토리텔링, 해시태그 활용. 감성적이고 미적인 표현.
      - **지침**: 대표 이미지와 어울리는 매력적인 캡션을 작성합니다. 본문 내용을 궁금하게 만드는 문구와 함께, 관련성 높은 해시태그를 5~10개 포함시키고 '프로필 링크 확인'과 같은 행동 유도 문구를 반드시 추가하세요. 문단 구분을 위해 줄바꿈을 적극적으로 사용해주세요.
      - **예시**: "✨ 새로운 힐링 공간을 발견했어요 ✨\\n\\n따뜻한 햇살이 들어오는 창가 자리에서\\n향긋한 커피 한 잔의 여유를 만끽하는 오후 ☕\\n\\n이곳의 특별한 점은 직접 로스팅하는 \\n신선한 원두와 정성스럽게 준비한 디저트들 🥐\\n\\n여러분도 소중한 사람과 함께 \\n특별한 시간을 만들어보세요 💕\\n\\n#카페 #신상카페 #커피 #힐링 #데일리 #카페스타그램\\n#커피타임 #여유 #일상 #추천카페"

    - **3. Facebook (페이스북)**
      - **특징**: 긴 텍스트 가능, 정보 전달 중심, 커뮤니티 성격. 정보적이고 상세한 설명.
      - **지침**: 블로그의 핵심 내용을 3~5 문장으로 구체적으로 요약합니다. 위치, 운영 시간 등 독자에게 유용한 정보를 포함하고, 정보 공유나 친구 태그를 유도하는 문구를 포함하여 참여를 이끌어내세요. 가독성을 위해 문단마다 줄바꿈을 해주세요.
      - **예시**: "🎉 우리 동네에 새로운 카페가 오픈했습니다!\\n\\n📍 위치: 서울시 강남구 ○○로 123번길\\n🕐 운영시간: 평일 7:00-22:00, 주말 8:00-23:00\\n☕ 주요 메뉴: 아메리카노(4,500원), 카페라떼(5,000원), 수제 디저트\\n\\n오늘 처음 방문해봤는데 정말 만족스러웠어요! \\n특히 바리스타님이 직접 로스팅한 원두로 내려주시는 커피는 \\n산미와 바디감이 절묘하게 균형 잡혀있더라구요.\\n\\n인테리어도 모던하면서 아늑한 분위기라 \\n혼자 책 읽기에도, 친구들과 수다 떨기에도 완벽해요.\\n\\n주차공간도 넉넉하고 와이파이도 빨라서 \\n재택근무하시는 분들에게도 추천드려요!\\n\\n다들 한번 가보세요~ 후기 댓글로 남겨주세요! 😊"

    - **4. X (구 트위터)**
      - **특징**: 간결함, 실시간성, 280자 제한. 직접적이고 즉각적인 반응.
      - **지침**: 블로그의 핵심 포인트를 불렛 포인트(✅)나 짧은 문장으로 요약합니다. 가독성을 위해 각 항목은 줄바꿈으로 구분해주세요. 핵심 키워드를 해시태그 2~3개로 포함하고, 블로그 링크 자리에는 '[BLOG_POST_LINK]'라는 플레이스홀더를 사용하세요.
      - **예시**: "새 카페 다녀옴 ☕\\n- 아메리카노 맛있음 ✅\\n- 사장님 친절 ✅\\n- 와이파이 빠름 ✅\\n- 가격 합리적 ✅\\n\n이정도면 단골 확정 아닌가?\\n누구 내일 같이 갈사람 🙋‍♂️\\n\\n#카페 #신상 #커피맛집"
    
    ${interactiveElementInstructions}

    ### 콘텐츠 작성 지침
    ${humanInstructions}
    ${contentInstructions}
    ${additionalRequestInstructions}
    - **문체와 톤**: 전문가이면서도 친근하고 자연스러운 대화체 ("~이에요", "~해요")를 사용하세요. 1인칭 시점("제 생각엔")과 감정 표현("정말 좋았어요")을 활용하여 인간적인 느낌을 주세요. **중요**: '안녕하세요'와 같은 서두 인사나 불필요한 자기소개는 **절대** 포함하지 말고, 독자의 흥미를 끄는 내용으로 바로 시작해주세요.
    - **구조화**: 도입부-본문-마무리 구조를 따릅니다. 본문은 h2, h3 태그로 명확히 구분하고, 리스트, 표, 정보 박스를 적극 활용하세요.
    - **가독성**: 본문 단락(\`<p>\`)은 **반드시** \`<p style="margin-bottom: 20px;">\` 스타일을 적용하여 단락 간의 간격을 명확하게 해주세요.
    - **시각적 요소**: 이모티콘을 섹션 제목에 적절히 사용해 가독성을 높여주세요. (예: 📚, 💡, ❓)
    - **신뢰성**: 개인적인 경험이나 일화를 포함하여 독자의 공감을 얻되, 주장은 신뢰할 수 있는 정보를 바탕으로 해야 합니다.
  `;

  const taskDescription = rawContent
    ? `Your primary task is to expand the user's provided notes into a complete, high-quality blog post titled "${topic}". You MUST use the provided notes as the core foundation for the article. The notes are included in the detailed instructions below.`
    : `Your task is to generate a complete blog post on the following topic: "${topic}".`;

  return `
    You are an expert content creator and web developer specializing in creating visually stunning and SEO-optimized blog posts with inline HTML and CSS.

    ${taskDescription}

    You must use the "${theme.name}" color theme. Here are the specific colors to use for inline styling: ${themeColors}.

    Follow these comprehensive instructions for structure, content, and tone:
    ${instructions}

    The final output must be a single, valid JSON object that strictly adheres to the provided response schema. The HTML code MUST be formatted for human readability. DO NOT minify the HTML. It is critical that you use proper indentation and newlines for every block-level element (\`<div>\`, \`<h2>\`, \`<p>\`, \`<ul>\`, \`<li>\`, etc.) to ensure the source code is clean and easy for a developer to read. Make sure to include the \`<!--IMAGE_PLACEHOLDER-->\` comment, which indicates where the main image will be programmatically inserted.
  `;
};

const getRegenerationPrompt = (originalHtml: string, feedback: string, theme: ColorTheme, currentDate: string): string => {
    const themeColors = JSON.stringify(theme.colors);
    
    return `
        You are an expert content editor and web developer tasked with revising an existing blog post based on user feedback.

        ### Context
        - **Today's Date**: ${currentDate}. If the user's feedback involves updating content to be more current, please use information relevant to today's date (${currentDate}).
        - **중요**: 시의성을 표시해야 할 경우, 월과 일은 제외하고 현재 연도(${new Date().getFullYear()}년)만 표시해주세요.

        ### User Feedback
        ---
        ${feedback}
        ---

        ### Task
        Revise the "Original Blog Post HTML" below according to the "User Feedback".

        ### Important Instructions
        1.  **Apply Feedback**: Carefully incorporate all points from the user feedback into the article.
        2.  **Maintain Structure**: You MUST preserve the original HTML structure, including placeholders like \`<!--IMAGE_PLACEHOLDER-->\`, \`<!--SUB_IMAGE_PLACEHOLDER_N-->\`, any interactive elements (\`<!-- Interactive Element Start -->\` to \`<!-- Interactive Element End -->\`), the summary card, the FAQ section, and the JSON-LD script. Do not add or remove these structural elements.
        3.  **Preserve Styles**: Adhere strictly to the provided color theme ("${theme.name}") and inline CSS styles. The theme colors are: ${themeColors}. Ensure all text colors, backgrounds, borders, etc., remain consistent with the original theme.
        4.  **Readable HTML**: The final HTML output MUST be well-formatted for human readability, with proper indentation and newlines for each block-level element. DO NOT minify or output the HTML on a single line.
        5.  **Output Format**: Your final output must be a single, valid JSON object that strictly adheres to the provided response schema, containing only the revised HTML in the \`blogPostHtml\` field.
        6.  **Do not** change the core topic of the article. Your only task is to edit the provided HTML content based on the feedback.

        ### Original Blog Post HTML
        ---
        ${originalHtml}
        ---
    `;
};

export const generateImage = async (prompt: string, aspectRatio: '16:9' | '1:1' = '16:9'): Promise<string | null> => {
    try {
        if (!prompt) return null;

        const imageResponse = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: aspectRatio,
            },
        });

        if (imageResponse.generatedImages && imageResponse.generatedImages.length > 0) {
            return imageResponse.generatedImages[0].image.imageBytes;
        }
        return null;
    } catch (error) {
        console.error("Error generating image:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to generate image: ${error.message}`);
        }
        throw new Error("An unknown error occurred while generating the image.");
    }
};


export const generateBlogPost = async (topic: string, theme: ColorTheme, shouldGenerateImage: boolean, shouldGenerateSubImages: boolean, interactiveElementIdea: string | null, rawContent: string | null, humanLikeWritingStyle: 'A' | 'B' | null, additionalRequest: string | null, aspectRatio: '16:9' | '1:1', currentDate: string): Promise<GeneratedContent> => {
  try {
    const prompt = getPrompt(topic, theme, interactiveElementIdea, rawContent, humanLikeWritingStyle, additionalRequest, currentDate);
    const contentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
    });

    const jsonString = contentResponse.text;
    const parsedJson = JSON.parse(jsonString);

    if (
        !parsedJson.blogPostHtml ||
        !parsedJson.supplementaryInfo ||
        !Array.isArray(parsedJson.supplementaryInfo.keywords) ||
        !parsedJson.supplementaryInfo.imagePrompt ||
        !parsedJson.supplementaryInfo.altText ||
        !Array.isArray(parsedJson.supplementaryInfo.seoTitles) ||
        !Array.isArray(parsedJson.supplementaryInfo.thumbnailTitles) ||
        !Array.isArray(parsedJson.supplementaryInfo.subImagePrompts) ||
        !parsedJson.socialMediaPosts
    ) {
        throw new Error("Received malformed JSON response from API for content generation.");
    }
    
    let imageBase64: string | null = null;
    if (shouldGenerateImage) {
        imageBase64 = await generateImage(parsedJson.supplementaryInfo.imagePrompt, aspectRatio);
    }
    
    let subImages: { prompt: string; altText: string; base64: string | null }[] | null = null;
    if (parsedJson.supplementaryInfo.subImagePrompts && parsedJson.supplementaryInfo.subImagePrompts.length > 0) {
        const subImagePromptObjects: { prompt: string; altText: string }[] = parsedJson.supplementaryInfo.subImagePrompts;
        
        const subImageBase64s = shouldGenerateSubImages
            ? await Promise.all(subImagePromptObjects.map(p => generateImage(p.prompt, '16:9')))
            : subImagePromptObjects.map(() => null);

        subImages = subImagePromptObjects.map((pObj, index) => ({
            prompt: pObj.prompt,
            altText: pObj.altText,
            base64: subImageBase64s[index]
        }));
    }

    const finalContent: GeneratedContent = {
        blogPostHtml: parsedJson.blogPostHtml,
        supplementaryInfo: parsedJson.supplementaryInfo,
        imageBase64: imageBase64,
        subImages: subImages,
        socialMediaPosts: parsedJson.socialMediaPosts,
    };

    return finalContent;

  } catch (error) {
    console.error("Error generating blog post:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate content: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the blog post.");
  }
};

export const regenerateBlogPostHtml = async (originalHtml: string, feedback: string, theme: ColorTheme, currentDate: string): Promise<string> => {
    try {
        const prompt = getRegenerationPrompt(originalHtml, feedback, theme, currentDate);
        const contentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: regenerationResponseSchema,
            },
        });

        const jsonString = contentResponse.text;
        const parsedJson = JSON.parse(jsonString);

        if (!parsedJson.blogPostHtml) {
            throw new Error("Received malformed JSON response from API for content regeneration.");
        }

        return parsedJson.blogPostHtml;

    } catch (error) {
        console.error("Error regenerating blog post HTML:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to regenerate content: ${error.message}`);
        }
        throw new Error("An unknown error occurred while regenerating the blog post.");
    }
};

const topicSuggestionSchema = {
    type: Type.OBJECT,
    properties: {
        topics: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "An array of 10 creative and SEO-optimized blog post topics in Korean."
        }
    },
    required: ["topics"]
};

const generateTopics = async (prompt: string, useSearch: boolean = false): Promise<string[]> => {
    try {
        const config: {
            responseMimeType?: "application/json",
            responseSchema?: typeof topicSuggestionSchema,
            tools?: {googleSearch: {}}[],
            temperature?: number;
        } = {};
        
        if (useSearch) {
             config.tools = [{googleSearch: {}}];
        } else {
             config.responseMimeType = "application/json";
             config.responseSchema = topicSuggestionSchema;
        }

        config.temperature = 1.0;
        
        const enhancedPrompt = `${prompt}\n\n(This is a new request. Please generate a completely new and different set of suggestions. Random seed: ${Math.random()})`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: enhancedPrompt,
            config: config,
        });

        if (useSearch) {
            const text = response.text;
            // When using googleSearch, the output is not guaranteed to be JSON.
            // We'll parse it as a simple newline-separated list.
            let lines = text.split('\n').map(topic => topic.trim()).filter(Boolean);
            // Heuristically remove a potential introductory sentence.
            if (lines.length > 1 && (lines[0].includes('다음은') || lines[0].endsWith('입니다.') || lines[0].endsWith('입니다:'))) {
                lines.shift();
            }
            return lines.map(topic => topic.replace(/^(\d+\.|-|\*)\s*/, '').trim()).filter(Boolean);
        }

        const jsonString = response.text;
        const parsedJson = JSON.parse(jsonString);

        if (!parsedJson.topics || !Array.isArray(parsedJson.topics)) {
            throw new Error("Received malformed JSON response from API for topic suggestion.");
        }
        return parsedJson.topics;
    } catch (error) {
        console.error("Error generating topics:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to generate topics: ${error.message}`);
        }
        throw new Error("An unknown error occurred while generating topics.");
    }
};

export const generateEeatTopicSuggestions = (field: string, contentType: string, currentDate: string): Promise<string[]> => {
  const prompt = `
    당신은 구글 검색 상위 노출을 위한 콘텐츠 전략을 수립하는 최상위 SEO 전문가입니다.
    당신의 임무는 구글의 E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) 원칙을 극대화하여, 실제 사용자의 문제를 해결하고 검색 결과에서 눈에 띄는 실용적인 블로그 포스트 주제 10가지를 제안하는 것입니다.

    **콘텐츠 분야**: "${field}"
    **콘텐츠 유형**: "${contentType}"
    **분석 기준일**: ${currentDate}

    [매우 중요한 지침]
    1.  **실질적인 경험(Experience) 강조**: '실제 사용 후기', '내가 직접 해본', 'N개월 경험담', '성공/실패 사례' 등 개인적인 경험이 드러나는 제목을 최소 3개 이상 포함하세요.
    2.  **명확한 전문성(Expertise) 제시**: '전문가 가이드', '초보자를 위한 완벽 분석', 'A to Z 총정리', '심층 비교' 등 깊이 있는 지식을 약속하는 제목을 제안하세요.
    3.  **검색 의도 충족**: 사용자가 무엇을 원하는지(정보 탐색, 문제 해결, 구매 고려 등) 명확히 파악하고, 그에 대한 해답을 제목에서부터 제시해야 합니다.
    4.  **구체성과 실용성**: 추상적인 주제가 아닌, 독자가 글을 읽고 바로 적용할 수 있는 구체적이고 실용적인 주제를 제안하세요. (예: '좋은 습관' -> '매일 10분 투자로 인생을 바꾸는 미라클 모닝 5단계 실천법')
    5.  **시의성 반영**: 제안하는 주제는 오늘 날짜(${currentDate})를 기준으로 최신 정보를 반영해야 합니다. 연도가 필요하다면 현재 연도만 사용하고, 불필요한 연도 표기는 피해주세요.

    결과는 반드시 한국어로, 창의적이고 클릭을 유도하는 구체적인 제목 형식으로 제안해주세요.
  `;
  return generateTopics(prompt);
};

export const generateCategoryTopicSuggestions = (category: string, currentDate: string): Promise<string[]> => {
  const prompt = `
    당신은 창의적인 콘텐츠 기획자입니다.
    '${category}' 카테고리와 관련된 흥미로운 블로그 포스트 주제 10가지를 추천해주세요.
    독자의 호기심을 자극하고, 실용적인 정보를 제공하며, 소셜 미디어에 공유하고 싶게 만드는 매력적인 주제여야 합니다.
    오늘은 ${currentDate} 입니다. 제안하는 주제는 오늘 날짜를 기준으로 최신 트렌드를 반영해야 합니다. **시의성이 필요하여 연도를 표시할 경우, 월과 일은 제외하고 연도만 사용해주세요.** 단, 연도가 주제의 핵심이 아닌 이상 불필하게 포함하지 마세요.
    결과는 반드시 한국어로, 구체적인 제목 형식으로 제안해주세요.
  `;
  return generateTopics(prompt);
};

export const generateEvergreenTopicSuggestions = (field: string, contentType: string, currentDate: string): Promise<string[]> => {
  const prompt = `
    당신은 블로그 콘텐츠 전략가입니다.
    시간이 지나도 가치가 변하지 않아 꾸준한 트래픽을 유도할 수 있는 '에버그린 콘텐츠' 주제 10가지를 추천해주세요.
    콘텐츠 분야는 '${field}'이고, 콘텐츠 유형은 '${contentType}'입니다.
    오늘은 ${currentDate} 입니다. 제안하는 주제는 오늘 날짜의 최신 관점을 반영하여 주제를 더 매력적으로 만들어주세요. (예: "${new Date().getFullYear()}년 개정판: OOO 완벽 가이드"). **시의성이 필요하여 연도를 표시할 경우, 월과 일은 제외하고 연도만 사용해주세요.** 하지만 에버그린 콘텐츠의 특성상, 연도가 반드시 필요한 경우가 아니라면 제목에 포함하지 않는 것이 좋습니다.
    
    주제는 초보자도 쉽게 이해할 수 있으면서도, 깊이 있는 정보를 담을 수 있는 형태여야 합니다.
    결과는 반드시 한국어로, "OOO 하는 방법", "초보자를 위한 OOO 완벽 가이드" 와 같이 구체적인 제목 형식으로 제안해주세요.
  `;
  return generateTopics(prompt);
};

export const generateLongtailTopicSuggestions = (category: string, currentDate: string): Promise<string[]> => {
  const prompt = `
    당신은 SEO 전문가이며, 특히 롱테일 키워드 전략에 능숙합니다.
    '${category}' 분야에서 경쟁이 비교적 낮으면서도 구매 또는 전환 가능성이 높은 타겟 독자를 공략할 수 있는 '롱테일 키워드' 기반 블로그 주제 10가지를 추천해주세요.
    
    주제는 매우 구체적이고 명확한 검색 의도를 담고 있어야 합니다.
    예를 들어, '다이어트'가 아닌 '30대 직장인 여성을 위한 저탄고지 도시락 식단 추천'과 같은 형식이어야 합니다.
    결과는 반드시 한국어로, 구체적인 제목 형식으로 제안해주세요.
    **반드시** 오늘은 ${currentDate} 라는 점을 인지하고, 최신 트렌드를 반영하기 위해 구글 검색을 활용해주세요. **시의성이 필요하여 연도를 표시할 경우, 월과 일은 제외하고 연도만 사용해주세요.** 연도는 검색 의도에 꼭 필요한 경우에만 포함하세요.

    **아주 중요**: 응답은 오직 추천 주제 10가지의 목록만 포함해야 합니다. 서론, 부연 설명, 숫자, 글머리 기호 등 어떠한 추가 텍스트도 절대 포함하지 말고, 각 주제를 개행으로만 구분해서 반환해주세요.
  `;
  return generateTopics(prompt, true);
};

export const generateTopicsFromMemo = (memo: string, currentDate: string): Promise<string[]> => {
  const prompt = `
    당신은 뛰어난 편집자이자 콘텐츠 기획자입니다.
    아래에 제공된 메모/초안의 핵심 내용을 분석하고, 이 내용을 바탕으로 가장 매력적인 블로그 포스트 주제 10가지를 추천해주세요.
    
    오늘은 ${currentDate} 입니다. 메모의 내용을 바탕으로 오늘 날짜의 최신 관점을 반영하여 주제를 제안해주세요. **시의성이 필요하여 연도를 표시할 경우, 월과 일은 제외하고 연도만 사용해주세요.** 연도는 주제의 맥락상 자연스럽고 꼭 필요한 경우에만 포함하세요.
    
    [사용자 제공 메모]
    ---
    ${memo}
    ---
    
    결과는 반드시 한국어로, 구체적인 제목 형식으로 제안해주세요.
  `;
  return generateTopics(prompt);
};

export const suggestInteractiveElementForTopic = async (topic: string): Promise<string> => {
    const prompt = `
        You are a creative web developer and UI/UX designer.
        For the blog post topic "${topic}", suggest a single, simple, and engaging interactive element idea that can be implemented using only HTML, CSS, and vanilla JavaScript.
        The idea should be concise and described in a single sentence in Korean.
        For example: "간단한 투자 수익률을 계산해주는 계산기" or "나에게 맞는 커피 원두를 추천해주는 퀴즈".
        Just return the idea itself, without any introductory phrases.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0.8,
            },
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error suggesting interactive element:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to suggest interactive element: ${error.message}`);
        }
        throw new Error("An unknown error occurred while suggesting an interactive element.");
    }
};
