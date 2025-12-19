import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // loadEnv는 .env, .env.local, .env.[mode], .env.[mode].local 파일을 로드합니다
    // 세 번째 인자 ''는 모든 환경 변수를 로드합니다 (VITE_ 접두사 없이도)
    const env = loadEnv(mode, process.cwd(), '');
    
    // API_KEY를 찾기 위해 여러 가능성을 확인 (.env.local에 API_KEY로 설정되어 있을 수 있음)
    const geminiApiKey = env.GEMINI_API_KEY || env.API_KEY || env.VITE_GEMINI_API_KEY;
    
    // 디버깅용 (개발 모드에서만)
    if (mode === 'development') {
        if (!geminiApiKey) {
            console.warn('⚠️ API 키가 .env.local 파일에서 찾을 수 없습니다.');
            console.warn('   .env.local 파일에 GEMINI_API_KEY=your_api_key 또는 API_KEY=your_api_key 형식으로 설정해주세요.');
        } else {
            console.log('✅ API 키가 성공적으로 로드되었습니다.');
        }
    }
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(geminiApiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
