
import React from 'react';
import type { NaverNewsData, NewsStrategyIdea } from '../types';

interface NaverNewsResultsProps {
    data: NaverNewsData[];
    onGenerateStrategy: () => void;
    strategyLoading: boolean;
    strategy: NewsStrategyIdea[] | null;
    onTopicSelect: (title: string, context: string) => void;
}

const NaverNewsResults: React.FC<NaverNewsResultsProps> = ({ data, onGenerateStrategy, strategyLoading, strategy, onTopicSelect }) => {

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch (e) {
            return dateString;
        }
    };
    
    const handleSelectStrategy = (idea: NewsStrategyIdea) => {
        const context = `[뉴스 기반 AI 전략]\n- 핵심 키워드: ${idea.keywords.join(', ')}\n- 콘텐츠 전략: ${idea.strategy}`;
        onTopicSelect(idea.title, context);
    };


    return (
        <div className="bg-slate-800 rounded-lg p-4 sm:p-6 shadow-lg border border-slate-700 animate-fade-in space-y-4">
            <h3 className="flex items-center text-lg font-bold text-green-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3h3m-3 4h3m-3 4h3m-3 4h3" /></svg>
                <span className="ml-2">Naver 실시간 뉴스 분석</span>
            </h3>
            <div className="space-y-4">
                {data.map((item) => (
                    <div key={item.id} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 hover:border-cyan-500/50 transition-colors">
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                             <p className="text-xs text-slate-400 mb-1">{formatDate(item.pubDate)}</p>
                             <h4 className="font-bold text-cyan-300 hover:underline mb-2">{item.title}</h4>
                             <p className="text-sm text-slate-300 leading-relaxed">{item.description}</p>
                        </a>
                    </div>
                ))}
            </div>
             {strategy && (
                <div className="mt-6 pt-4 border-t border-slate-700">
                    <h3 className="flex items-center text-lg font-bold text-yellow-400 mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M12 21v-1m-4.663-2H16.34" /></svg>
                        <span className="ml-2">AI 블로그 공략 전략 (클릭하여 주제 선택)</span>
                    </h3>
                    <div className="space-y-4">
                        {strategy.map((idea) => (
                            <div 
                                key={idea.id} 
                                onClick={() => handleSelectStrategy(idea)}
                                className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 hover:border-yellow-500/50 transition-all duration-200 cursor-pointer group"
                            >
                                <h4 className="font-bold text-yellow-300 group-hover:underline">{idea.title}</h4>
                                <div className="flex flex-wrap gap-2 my-2">
                                    {idea.keywords.map(kw => (
                                        <span key={kw} className="bg-slate-700 text-slate-300 text-xs font-medium px-2.5 py-1 rounded-full">{kw}</span>
                                    ))}
                                </div>
                                <p className="text-sm text-slate-300 leading-relaxed">{idea.strategy}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {!strategy && (
                <div className="mt-6 pt-4 border-t border-slate-700 text-center">
                    <button
                        onClick={onGenerateStrategy}
                        disabled={strategyLoading}
                        className="bg-yellow-600 text-white font-bold py-3 px-6 rounded-md hover:bg-yellow-500 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition duration-300 flex items-center justify-center w-full sm:w-auto mx-auto"
                    >
                        {strategyLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                                전략 생성 중...
                            </>
                        ) : 'AI 기반 블로그 공략 전략 생성'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default NaverNewsResults;