// src/features/simulator/SimulatorView.tsx
import React, { useEffect, useState } from "react";
import { useAppStore } from "../../state/store";
import { getInstrument, runSimulation } from "../../core/simulation-engine";
import { Slider } from "../../components/controls/Slider";
import { MeasurementDisplay } from "../../components/display/MeasurementDisplay";

export function SimulatorView() {
  const { activeInstrumentId, setInstrumentInput, instrumentInputs, instrumentOutputs, setInstrumentOutput } = useAppStore();
  const [inputValue, setInputValue] = useState(0);

  const instrument = activeInstrumentId ? getInstrument(activeInstrumentId) : null;

  useEffect(() => {
    if (!instrument) return;
    const input = instrumentInputs[instrument.id] ?? { value: 0 };
    setInputValue(input.value);
    const output = runSimulation(instrument.id, input);
    setInstrumentOutput(instrument.id, output);
  }, [activeInstrumentId, instrumentInputs, setInstrumentOutput]);

  if (!instrument) {
    return <div className="text-center text-gray-500 mt-20">Select an instrument from the sidebar</div>;
  }

  const handleInputChange = (value: number) => {
    setInputValue(value);
    setInstrumentInput(instrument.id, { value });
  };

  const output = instrumentOutputs[instrument.id] || { value: 0, unit: "unit" };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Controls</h2>
        <Slider
          label="Input value"
          value={inputValue}
          min={0}
          max={100}
          step={1}
          onChange={handleInputChange}
        />
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-4">Output</h2>
        <MeasurementDisplay value={output.value} unit={output.unit} label={instrument.name} />
      </div>
    </div>
  );
}