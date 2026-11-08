import React, { useState } from 'react';
import { predictService } from '../services/predictService';
import { PredictResponse, Species } from '../types';
import { Beaker, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

/**
 * Prediction Panel
 * Example of a UI component that interacts ONLY with services.
 * It handles its own loading and error states locally.
 */
export const PredictionPanel: React.FC<{ reactants: Species[] }> = ({ reactants }) => {
  const [prediction, setPrediction] = useState<PredictResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    try {
      // UI calling Service (NOT AI directly)
      const result = await predictService.predictReaction(reactants, 298);
      
      if (result) {
        setPrediction(result);
      } else {
        setError("AI could not generate a valid prediction for this mixture.");
      }
    } catch (err) {
      setError("A system error occurred during analysis.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-[var(--chem-surface2)] rounded-lg border border-[var(--chem-border)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Reaction Predictor</h3>
        <button 
          onClick={handlePredict}
          disabled={loading || reactants.length === 0}
          className="px-3 py-1.5 bg-[var(--chem-teal)] hover:bg-[var(--chem-teal-light)] disabled:opacity-50 disabled:cursor-not-allowed rounded text-[10px] font-bold transition-all flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Beaker className="w-3 h-3" />}
          ANALYZE MIXTURE
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded flex items-start gap-2 text-red-500 text-[10px]">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {prediction && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            {prediction.reactionOccurs ? (
              <CheckCircle className="w-4 h-4 text-[var(--chem-teal)]" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[var(--chem-amber)]" />
            )}
            <span className="text-sm font-bold">
              {prediction.reactionOccurs ? 'Reaction Predicted' : 'No Reaction Likely'}
            </span>
          </div>

          <p className="text-[11px] text-gray-400 leading-relaxed italic border-l-2 border-[var(--chem-border)] pl-3">
            "{prediction.explanation}"
          </p>

          {prediction.reactionOccurs && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="p-2 bg-[var(--chem-surface3)] rounded border border-[var(--chem-border)] text-center">
                <div className="text-[8px] text-gray-500 uppercase font-bold">Enthalpy</div>
                <div className="text-xs font-mono">{prediction.dH_kJ_per_mol} kJ/mol</div>
              </div>
              <div className="p-2 bg-[var(--chem-surface3)] rounded border border-[var(--chem-border)] text-center">
                <div className="text-[8px] text-gray-500 uppercase font-bold">Confidence</div>
                <div className="text-xs font-mono uppercase text-[var(--chem-teal)]">{prediction.confidence}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
