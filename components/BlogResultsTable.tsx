
import React from 'react';
import type { BlogPostData } from '../types';

const BlogResultsTable: React.FC<{ data: BlogPostData[] }> = ({ data }) => {
    return (
        <div className="bg-slate-800 rounded-lg overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
                <table className="w-full text-sm table-auto">
                    <thead className="bg-slate-700/50 text-slate-300 uppercase tracking-wider">
                        <tr>
                            <th scope="col" className="p-3 text-left w-16">No.</th>
                            <th scope="col" className="p-3 text-left">블로그 제목</th>
                            <th scope="col" className="p-3 text-left">바로가기</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {data.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-700/50 transition-colors duration-200">
                                <td className="p-3 text-slate-400 text-center">{item.id}</td>
                                <td className="p-3 font-medium text-cyan-300">{item.title}</td>
                                <td className="p-3">
                                    <a 
                                      href={item.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-slate-400 hover:text-cyan-400 hover:underline transition-colors duration-200"
                                      aria-label={`${item.title} (새 탭에서 열기)`}
                                    >
                                        바로가기
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BlogResultsTable;
