
import React, { useState } from 'react';
import { BudgetEntry } from '../types';
import { analyzeBudget } from '../services/geminiService';
import { MONTHS, CONSOLIDATED_ID } from '../constants';

interface AIAnalystProps {
    company: string;
    entries: BudgetEntry[];
}

const AIAnalyst: React.FC<AIAnalystProps> = ({ company, entries }) => {
    const [selectedMonth, setSelectedMonth] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [analysis, setAnalysis] = useState<string | null>(null);

    const handleAnalyze = async () => {
        setLoading(true);
        setAnalysis(null);
        const result = await analyzeBudget(company, selectedMonth, entries);
        setAnalysis(result);
        setLoading(false);
    };

    const companyLabel = company === CONSOLIDATED_ID ? "GRUPO VEZEEL (Consolidado)" : company;

    return (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-2xl border border-blue-100 h-full overflow-y-auto pb-20">
            <div className="flex items-center gap-3 mb-6">
                <div className="bg-indigo-600 p-2 rounded-lg text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                    </svg>
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">CFO IA Assistant</h2>
                    <p className="text-xs text-slate-500">Impulsado por Gemini 2.5</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 mb-6">
                <p className="text-sm text-gray-500 mb-2">Analizando: <span className="font-semibold text-slate-800">{companyLabel}</span></p>
                <div className="flex gap-2">
                    <select 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="flex-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm border"
                    >
                        {MONTHS.map((m, idx) => (
                            <option key={idx} value={idx}>{m} 2026</option>
                        ))}
                    </select>
                    <button 
                        onClick={handleAnalyze}
                        disabled={loading}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium text-sm flex items-center gap-2"
                    >
                        {loading ? 'Analizando...' : 'Generar Informe'}
                    </button>
                </div>
            </div>

            {analysis && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 prose prose-indigo max-w-none">
                    <div className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">
                        {analysis}
                    </div>
                </div>
            )}

            {!analysis && !loading && (
                <div className="text-center text-gray-400 mt-12">
                    <p>Selecciona un mes y haz clic en "Generar Informe" para obtener un análisis detallado de tus desvíos y recomendaciones estratégicas.</p>
                </div>
            )}
        </div>
    );
};

export default AIAnalyst;
