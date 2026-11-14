import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { LEGAL_RAG_COPY } from '../i18n/legalRagTranslations';
import { askLegalRag, type LegalRagResponse } from '../utils/legalRagClient';

export const LegalRagPanel: React.FC = () => {
  const { language } = useLanguage();
  const copy = LEGAL_RAG_COPY[language] || LEGAL_RAG_COPY.en;
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<LegalRagResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      setResult(await askLegalRag(question, language));
    } catch (err: any) {
      setError(err?.message || copy.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5">
      <header>
        <h2 className="text-xl font-bold text-zinc-950 dark:text-white">{copy.title}</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{copy.subtitle}</p>
      </header>

      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#18181B]">
        <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200" htmlFor="legal-rag-question">
          {copy.question}
        </label>
        <textarea
          id="legal-rag-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={copy.placeholder}
          maxLength={3000}
          rows={4}
          className="w-full rounded-xl border border-zinc-200 bg-transparent p-3 text-sm outline-none focus:border-blue-500 dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded-xl bg-[#007FFF] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          {loading ? copy.searching : copy.ask}
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#18181B]">
          <div className="whitespace-pre-wrap text-sm leading-7 text-zinc-800 dark:text-zinc-200">{result.answer}</div>
          {result.sources.length > 0 && (
            <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <h3 className="mb-3 text-sm font-bold">{copy.sources}</h3>
              <ol className="space-y-3">
                {result.sources.map((source) => (
                  <li
                    key={`${source.marker}-${source.sourceUrl}-${source.pageNumber ?? 1}`}
                    className="rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-900"
                  >
                    <div className="font-bold">
                      [{source.marker}] {source.title}
                      {source.pageNumber ? ` · p. ${source.pageNumber}` : ''}
                    </div>
                    <div className="mt-1 text-zinc-500">
                      {source.authority}
                      {source.sectionRef ? ` · ${source.sectionRef}` : ''}
                      {source.effectiveDate ? ` · ${source.effectiveDate}` : ''}
                    </div>
                    <p className="mt-2 leading-5 text-zinc-600 dark:text-zinc-400">{source.excerpt}</p>
                    <a
                      className="mt-2 inline-block font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      href={source.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {source.sourceUrl}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {!result && !error && <p className="text-xs text-zinc-500">{copy.empty}</p>}
      <p className="text-xs leading-5 text-zinc-500">{copy.disclaimer}</p>
    </section>
  );
};
