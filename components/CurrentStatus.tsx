import React, { useState, useEffect, FC } from 'react';
import { fetchCurrentWeather } from '../services/keywordService';
import type { WeatherData } from '../types';

export const CurrentStatus: FC = () => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const weatherData = await fetchCurrentWeather();
                setWeather(weatherData);
            } catch (e) {
                console.error("Failed to fetch weather", e);
                setWeather({condition: '날씨 정보 로딩 실패', temperature: '', wind: '', humidity: ''});
            }
        };
        fetchWeather();
        const timer = setInterval(() => setTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const formattedDate = new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    }).format(time);

    const formattedTime = new Intl.DateTimeFormat('ko-KR', {
        hour: '2-digit', minute: '2-digit', hour12: true
    }).format(time);

    return (
        <div className="text-sm text-slate-400 mb-4 text-center p-2 bg-gray-800 rounded-lg">
           <span>{formattedDate} {formattedTime}</span>
           {weather && (
               <span className="ml-4">
                   서울: {weather.condition}, {weather.temperature}
               </span>
           )}
        </div>
    )
}
