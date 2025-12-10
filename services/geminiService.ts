
import { GoogleGenAI } from "@google/genai";
import { BudgetEntry, CategoryType } from "../types";
import { MONTHS, CONSOLIDATED_ID } from "../constants";

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API Key not found");
    }
    return new GoogleGenAI({ apiKey });
};

export const analyzeBudget = async (
    company: string,
    monthIndex: number, // 0-11
    entries: BudgetEntry[]
): Promise<string> => {
    try {
        const ai = getClient();
        const monthName = MONTHS[monthIndex];

        // Filter data for the context (Handle Consolidated view or Single Company)
        const relevantEntries = entries.filter(e => 
            (company === CONSOLIDATED_ID ? true : e.company === company) && 
            e.month === monthIndex + 1
        );
        
        const companyName = company === CONSOLIDATED_ID ? "GRUPO VEZEEL (Consolidado)" : company;

        // Prepare a summary string for the model
        let dataSummary = `Análisis para: ${companyName}, Mes: ${monthName} 2026.\n`;
        
        let totalIncomePlan = 0;
        let totalIncomeReal = 0;
        let totalExpensePlan = 0;
        let totalExpenseReal = 0;

        dataSummary += "Detalle por categoría:\n";
        
        relevantEntries.forEach(entry => {
            const variance = entry.realValue - entry.planValue;
            const variancePercent = entry.planValue !== 0 ? ((variance / entry.planValue) * 100).toFixed(1) : '0';
            
            dataSummary += `- ${entry.category} / ${entry.subCategory}: Plan $${entry.planValue}, Real $${entry.realValue}. Desvío: ${variance > 0 ? '+' : ''}${variance} (${variancePercent}%).\n`;

            if (entry.category === 'Ingresos') {
                totalIncomePlan += entry.planValue;
                totalIncomeReal += entry.realValue;
            } else {
                totalExpensePlan += entry.planValue;
                totalExpenseReal += entry.realValue;
            }
        });

        const netResultPlan = totalIncomePlan - totalExpensePlan;
        const netResultReal = totalIncomeReal - totalExpenseReal;

        dataSummary += `\nRESUMEN FINAL:\n`;
        dataSummary += `Resultado Neto Planificado: $${netResultPlan}\n`;
        dataSummary += `Resultado Neto Real: $${netResultReal}\n`;

        const prompt = `
        Actúa como un experto Director Financiero (CFO). Analiza los siguientes datos presupuestarios para "${companyName}".
        
        DATOS:
        ${dataSummary}

        TAREA:
        1. Identifica los desvíos más críticos (positivos o negativos).
        2. Explica brevemente qué impacto tienen estos desvíos en la rentabilidad.
        3. Da 3 recomendaciones ejecutivas cortas y accionables para corregir el rumbo o potenciar resultados el próximo mes.
        
        Formato de respuesta: Markdown limpio, usa negritas para resaltar cifras clave. Sé directo y profesional.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "No se pudo generar el análisis.";
    } catch (error) {
        console.error("Error calling Gemini:", error);
        return "Hubo un error al conectar con el asistente financiero. Por favor verifica tu conexión o intenta más tarde.";
    }
};
