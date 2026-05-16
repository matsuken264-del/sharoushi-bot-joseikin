'use client';

import { useState, useRef, useEffect, useTransition, FormEvent, KeyboardEvent, ChangeEvent } from 'react';
import { generateAnswer, generateKadFiveAreaReport } from './actions';
import { Send, Bot, User, Volume2, StopCircle, Loader2, Paperclip } from 'lucide-react';
// Markdown表示用のライブラリをインポート
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// メッセージの型定義
interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  files?: string[];
  isLoading?: boolean;
  isError?: boolean;
}
type KadAreaKey = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

const KAD_QUESTIONS: {
  key: KadAreaKey;
  label: string;
  question: string;
}[] = [
  {
    key: 'wood',
    label: '育成力',
    question: '入社後、最初の1週間・1か月で、どのような業務を覚えていく想定ですか？'
  },
  {
    key: 'fire',
    label: '魅力発信力',
    question: 'この仕事は、顧客・利用者・地域・社内に対して、どのような価値を提供していますか？'
  },
  {
    key: 'earth',
    label: '受入定着力',
    question: '入社後に困ったとき、誰にどのように相談できますか？'
  },
  {
    key: 'metal',
    label: '条件明確性',
    question: '求人票に記載した労働条件と、実際の運用でズレが生じやすい点はありますか？'
  },
  {
    key: 'water',
    label: '情報透明性',
    question: '応募前に正直に伝えておいた方がよい、この仕事の大変な点やミスマッチ要因はありますか？'
  }
];
// ↑ここまで追加

export default function Home() {
  // チャット履歴を管理するステート
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      role: 'ai',
      content: 'こんにちは！人材確保AIコンサルタントver2.0（Gemini 3.1 Pro Preview搭載）です。\n\n資料(求人票の他、雇用管理制度・事業所HP等の補足資料（個人情報不可）など)のアップロードが可能です。\n\n資料をアップロードして数分お待ちください。コンサルティング結果が出力されます。\n\n何かお手伝いできることはありますか？\n\n◆注意事項・免責事項\n\n※個人情報の入力は行わないでください。\n\n※生成AIは誤った回答する場合があります。参考・補助に止めてください。\n\n※AIの回答によって生じた損害については、一切責任を負いません。\n\n※利用者の責任と判断においてご利用ください。\n\nproduced by [M\'s Lab 人材マネジメント研究所（HPの名称です）](https://sites.google.com/view/ragunarockguy/%E3%83%9B%E3%83%BC%E3%83%A0?authuser=0)\n\n [RAGUNAROCK PROJECTとは？](https://sites.google.com/view/ragunarockguy/raguna-rock-project)'
    }
  ]);
  // 送信中のローディング状態
  const [isPending, startTransition] = useTransition();
  // 音声読み上げの状態管理
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  
  // ▼▼▼ 採用力5領域診断用 state ▼▼▼
  const [showKadPrompt, setShowKadPrompt] = useState(false);
  const [showKadForm, setShowKadForm] = useState(false);
  const [lastBasicAnalysis, setLastBasicAnalysis] = useState('');
  const [lastUserQuestion, setLastUserQuestion] = useState('');
  const [lastUploadedFiles, setLastUploadedFiles] = useState<File[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [kadAnswers, setKadAnswers] = useState<Record<KadAreaKey, string>>({
    wood: '',
    fire: '',
    earth: '',
    metal: '',
    water: ''
  });
  // ▲▲▲ 採用力5領域診断用 state ▲▲▲
  // synthRefに「SpeechSynthesis または null」が入ることを明示します
  const synthRef = useRef<SpeechSynthesis | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  // --- 音声読み上げ機能 ---
  const handleSpeak = (text: string, messageId: string) => {
    if (!synthRef.current) return;

    if (synthRef.current.speaking) {
      synthRef.current.cancel();
      if (speakingMessageId === messageId) {
        setSpeakingMessageId(null);
        return;
      }
    }

    // Markdown記号などを読み上げさせないための簡易的なクレンジング
    const plainText = text
      .replace(/[#*`~\[\]()<>#-]/g, '') // 記号を除去
      .replace(/\n/g, '、') // 改行を読点に置換して少し間を持たせる
      .trim();

    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // 声質の選択を試みる処理
    const voices = synthRef.current.getVoices();
    const jpVoices = voices.filter(v => v.lang.includes('ja') || v.lang.includes('JP'));
    
    const preferredVoiceName = jpVoices.find(v => 
        v.name.includes('Google') ||
        v.name.includes('Ichiro') ||
        v.name.includes('Ayumi')
    );

    if (preferredVoiceName) {
        utterance.voice = preferredVoiceName;
    } else if (jpVoices.length > 0) {
        utterance.voice = jpVoices[0];
    }

    utterance.onstart = () => setSpeakingMessageId(messageId);
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    synthRef.current.speak(utterance);
  };


    // --- 送信ハンドラ ---
  const handleSubmit = async (formData: FormData) => {
    const question = formData.get('question') as string;
    const formFiles = formData.getAll('files').filter(
      (file): file is File => file instanceof File && file.size > 0
    );

    const files = selectedFiles.length > 0 ? selectedFiles : formFiles;

    if (!question?.trim() && files.length === 0) return;

    setShowKadPrompt(false);
    setShowKadForm(false);

    const userMessageId = Date.now().toString();
    const newUserMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: question,
      files: files.length > 0 ? files.map(f => f.name) : []
    };

    setMessages(prev => [...prev, newUserMessage]);
    formRef.current?.reset();

    startTransition(async () => {
      const aiTempId = (Date.now() + 1).toString();

      setMessages(prev => [
        ...prev,
        {
          id: aiTempId,
          role: 'ai',
          content: '考え中...',
          isLoading: true
        }
      ]);

      try {
        const submitFormData = new FormData();
        submitFormData.append('question', question);

        files.forEach(file => {
          submitFormData.append('files', file, file.name);
        });

        const result = await generateAnswer(null, submitFormData);

        setMessages(prev => prev.map(msg =>
          msg.id === aiTempId
            ? {
                id: aiTempId,
                role: 'ai',
                content: result.answer,
                isLoading: false,
                isError: !result.success
              }
            : msg
        ));

        if (result.success) {
          setLastBasicAnalysis(result.answer);
          setLastUserQuestion(question);
          setLastUploadedFiles(files);
          setSelectedFiles([]);
          setShowKadPrompt(true);
          setShowKadForm(false);
        }

      } catch (error: any) {
        setMessages(prev => prev.map(msg =>
          msg.id === aiTempId
            ? {
                id: aiTempId,
                role: 'ai',
                content: `エラーが発生しました: ${error.message}`,
                isLoading: false,
                isError: true
              }
            : msg
        ));
      }
    });
  };

  // --- 採用力5領域診断 送信ハンドラ ---
  const handleKadDiagnosis = async () => {
    if (!lastBasicAnalysis) return;

    setShowKadForm(false);
    setShowKadPrompt(false);

    startTransition(async () => {
      const userMessageId = Date.now().toString();

      const userSummary = KAD_QUESTIONS.map(q => {
        return `【${q.label}】\n${q.question}\n回答：${kadAnswers[q.key] || '未回答'}`;
      }).join('\n\n');

      setMessages(prev => [
        ...prev,
        {
          id: userMessageId,
          role: 'user',
          content: `採用力5領域診断を希望します。\n\n${userSummary}`
        }
      ]);

      const aiTempId = (Date.now() + 1).toString();

      setMessages(prev => [
        ...prev,
        {
          id: aiTempId,
          role: 'ai',
          content: '採用力5領域診断を作成中...',
          isLoading: true
        }
      ]);

      try {
        const diagnosisFormData = new FormData();
        diagnosisFormData.append('originalQuestion', lastUserQuestion);
        diagnosisFormData.append('basicAnalysis', lastBasicAnalysis);
        diagnosisFormData.append('kadAnswers', JSON.stringify(kadAnswers, null, 2));

        lastUploadedFiles.forEach(file => {
          diagnosisFormData.append('files', file, file.name);
        });

        const result = await generateKadFiveAreaReport(null, diagnosisFormData);

        setMessages(prev => prev.map(msg =>
          msg.id === aiTempId
            ? {
                id: aiTempId,
                role: 'ai',
                content: result.answer,
                isLoading: false,
                isError: !result.success
              }
            : msg
        ));

      } catch (error: any) {
        setMessages(prev => prev.map(msg =>
          msg.id === aiTempId
            ? {
                id: aiTempId,
                role: 'ai',
                content: `採用力5領域診断でエラーが発生しました: ${error.message}`,
                isLoading: false,
                isError: true
              }
            : msg
        ));
      }
    });
  };

  return (
    <main className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans">
      
      {/* ヘッダー */}
      <header className="flex items-center p-4 bg-white dark:bg-gray-800 shadow-md z-10">
        <Bot className="w-8 h-8 text-blue-500 mr-3" />
        <h1 className="text-xl font-bold">人材確保AIコンサルタントVer2.0 (Gemini 3.1 Pro Preview)</h1>
      </header>

      {/* チャットエリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {/* AIのアバター */}
            {msg.role === 'ai' && (
              <div className="flex-shrink-0 mr-3">
                <div className={`p-2 rounded-full ${msg.isError ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-500'} dark:bg-gray-700`}>
                  <Bot className="w-6 h-6" />
                </div>
              </div>
            )}

            {/* メッセージの吹き出し */}
            <div
              className={`relative max-w-[85%] p-4 rounded-2xl shadow-sm ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white rounded-tr-none'
                  : 'bg-white dark:bg-gray-800 dark:text-gray-100 rounded-tl-none border border-gray-200 dark:border-gray-700'
              }`}
            >
              {msg.isLoading && (
                <div className="flex items-center text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  考え中...
                </div>
              )}

              {!msg.isLoading && (
                // Markdownとして表示するコンポーネント。divで囲んでclassName型エラーを回避
                <div className="prose dark:prose-invert max-w-none leading-relaxed break-words">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            // リンクを新しいタブで開くように設定
                            a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline hover:text-blue-700" />
                        }}
                    >
                    {msg.content}
                    </ReactMarkdown>
                </div>
              )}
              
              {msg.files && msg.files.length > 0 && (
                 <div className="mt-2 text-sm text-blue-200 flex flex-wrap gap-2">
                   {msg.files.map((f,i) => (
                       <span key={i} className="flex items-center bg-blue-600 px-2 py-1 rounded">
                           <Paperclip className="w-3 h-3 mr-1"/> {f}
                       </span>
                   ))}
                 </div>
              )}

              {msg.role === 'ai' && !msg.isLoading && !msg.isError && (
                <button
                  onClick={() => handleSpeak(msg.content, msg.id)}
                  className="absolute -bottom-8 left-0 p-1 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                  title="読み上げ"
                >
                  {speakingMessageId === msg.id ? (
                    <StopCircle className="w-5 h-5 animate-pulse text-blue-500" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>

            {/* ユーザーのアバター */}
            {msg.role === 'user' && (
              <div className="flex-shrink-0 ml-3">
                <div className="p-2 rounded-full bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  <User className="w-6 h-6" />
                </div>
              </div>
            )}
          </div>
        ))}
        {showKadPrompt && !showKadForm && (
  <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-900 rounded-2xl p-5 shadow-sm">
    <h2 className="text-lg font-bold mb-2 text-blue-600 dark:text-blue-400">
      さらに詳しく診断できます
    </h2>

    <p className="text-sm leading-relaxed mb-4 text-gray-700 dark:text-gray-300">
      求人票だけでは分かりにくい「育成体制」「職場環境」「情報の透明性」「定着リスク」まで含めて、
      採用力5領域診断を作成できます。
    </p>

    <p className="text-sm mb-4 text-gray-700 dark:text-gray-300">
      追加質問に回答して、採用力5領域診断を行いますか？
    </p>

    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => setShowKadForm(true)}
        className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
      >
        はい、追加診断へ進む
      </button>

      <button
        type="button"
        onClick={() => setShowKadPrompt(false)}
        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      >
        いいえ、通常診断のみで終了
      </button>
    </div>
  </div>
)}

{showKadForm && (
  <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-900 rounded-2xl p-5 shadow-sm">
    <h2 className="text-lg font-bold mb-2 text-blue-600 dark:text-blue-400">
      採用力5領域診断：追加質問
    </h2>

    <p className="text-sm leading-relaxed mb-4 text-gray-700 dark:text-gray-300">
      未記入の項目があっても診断は可能ですが、回答が多いほど具体的な改善提案になります。
    </p>

    <div className="space-y-4">
      {KAD_QUESTIONS.map((item, index) => (
        <div key={item.key}>
          <label className="block text-sm font-bold mb-1 text-gray-800 dark:text-gray-100">
            Q{index + 1}. {item.label}
          </label>

          <p className="text-sm mb-2 text-gray-600 dark:text-gray-400">
            {item.question}
          </p>

          <textarea
            value={kadAnswers[item.key]}
            onChange={(e) =>
              setKadAnswers(prev => ({
                ...prev,
                [item.key]: e.target.value
              }))
            }
            rows={3}
            className="w-full p-3 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-800 dark:text-gray-200"
            placeholder="回答を入力してください"
          />
        </div>
      ))}
    </div>

    <div className="flex gap-3 mt-5">
      <button
        type="button"
        onClick={handleKadDiagnosis}
        disabled={isPending}
        className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        採用力5領域診断を作成する
      </button>

      <button
        type="button"
        onClick={() => {
          setShowKadForm(false);
          setShowKadPrompt(true);
        }}
        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      >
        戻る
      </button>
    </div>
  </div>
)}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア (固定フッター) */}
      <footer className="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700">
        <form ref={formRef} action={handleSubmit} className="max-w-5xl mx-auto">
          
          {/* 入力エリアとボタンを横並びにするレイアウト */}
          <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                name="question"
                placeholder="コメントを入力してください..."
                rows={2} // 初期高さを少し低く
                className="w-full p-3 bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-800 dark:text-gray-200"
                onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        formRef.current?.requestSubmit();
                    }
                }}
                />
            </div>
            {/* 送信ボタンをテキストエリアの外に出す */}
            <button
              type="submit"
              disabled={isPending}
              className="p-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex-shrink-0"
              title="送信 (Ctrl + Enter)"
            >
              {isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
            </button>
          </div>

          <div className="flex items-center justify-between mt-3 text-sm text-gray-600 dark:text-gray-400">
             <label htmlFor="file-upload" className="cursor-pointer flex items-center hover:text-blue-500">
                 <Paperclip className="w-5 h-5 mr-2" />
                 <span>対象資料(求人票の他、雇用管理制度・事業所HP等の補足資料（個人が特定される情報不可）など)をアップロード (PDF,JPEG,PNG)</span>
                 <input
                    id="file-upload"
                    type="file"
                    name="files"
                    accept="application/pdf, image/jpeg, image/png"
                    multiple
                    className="hidden" // input自体は隠す
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files ?? []);
  setSelectedFiles(files);
                        // ファイルが選択されたら、ファイル名を入力欄に表示するなどの処理をここに追加できます
                        // 今回はシンプルにするため、特に何もしません
                    }}
                 />
             </label>
             <p className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                 Gemini 3 Pro Preview は誤った情報を生成する可能性があります。(Ctrl+Enterで送信)
             </p>
          </div>
        </form>
      </footer>
    </main>
  );
}