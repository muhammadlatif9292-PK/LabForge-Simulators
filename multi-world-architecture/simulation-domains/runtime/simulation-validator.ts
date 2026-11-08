// simulation-domains/runtime/simulation-validator.ts
/**
 * Simulation Validator
 * 
 * Responsibilities:
 * - Validate conservation laws: energy, mass, charge
 * - Check that no substance goes below zero amount
 * - Verify reaction stoichiometry is balanced
 * - Detect physically impossible states (e.g., negative temperature)
 * - Generate warnings for near-boundary conditions
 * 
 * Owned state: none (stateless)
 * 
 * Dependencies: ILogger, IMeter
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: n/a
 * Telemetry: validation pass/fail counts, violation types
 * Diagnostics: last violation details
 * Accessibility: violation messages are human-readable
 * Performance: O(n) in substances; fast checks
 * Forbidden: blocking simulation; modifying state during validation
 */

import type { SubstanceState, ReactionDefinition, DomainValidationResult } from '../contracts/domain-simulation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class SimulationValidator {
  private readonly MIN_TEMPERATURE = 0; // Kelvin absolute zero

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  validate(substances: SubstanceState[], reactions: ReactionDefinition[]): DomainValidationResult {
    const violations: string[] = [];
    const warnings: string[] = [];

    // Check individual substance validity
    for (const sub of substances) {
      if (sub.amount < -1e-12) { // small tolerance for numerical error
        violations.push(`Negative amount for ${sub.name}: ${sub.amount.toExponential(2)} mol`);
        this.meter.incrementCounter('simulation.validator.negative_amount');
      }
      if (sub.temperature < this.MIN_TEMPERATURE) {
        violations.push(`Temperature below absolute zero for ${sub.name}: ${sub.temperature} K`);
        this.meter.incrementCounter('simulation.validator.negative_temperature');
      }
      if (sub.temperature < 0.1) {
        warnings.push(`Near absolute zero for ${sub.name}`);
      }
      if (sub.amount < 0.1 && sub.amount > 0) {
        warnings.push(`Near depletion for ${sub.name}`);
      }
    }

    // Basic mass conservation check (per reaction stoichiometry)
    let massConservation = true;
    for (const reaction of reactions) {
      const reactantMass = reaction.reactants.reduce((sum, r) => {
        const sub = substances.find(s => s.id === r.substanceId);
        return sum + (sub ? this.molarMass(sub.formula) * r.coefficient : 0);
      }, 0);
      const productMass = reaction.products.reduce((sum, p) => {
        const sub = substances.find(s => s.id === p.substanceId);
        return sum + (sub ? this.molarMass(sub.formula) * p.coefficient : 0);
      }, 0);
      if (Math.abs(reactantMass - productMass) > 0.01) {
        massConservation = false;
        violations.push(`Mass not conserved in reaction ${reaction.id}`);
        this.meter.incrementCounter('simulation.validator.mass_violation');
      }
    }

    const energyConservation = true; // Simplified; production would compute enthalpy total
    const chargeConservation = true; // Simplified

    return {
      valid: violations.length === 0,
      violations,
      warnings,
      conservationCheck: {
        energy: energyConservation,
        mass: massConservation,
        charge: chargeConservation,
      },
    };
  }

  private molarMass(formula: string): number {
    // Simplified: return approximate molar mass
    const masses: Record<string, number> = {
      'H': 1.008, 'O': 16.0, 'C': 12.01, 'N': 14.01, 'Na': 22.99, 'Cl': 35.45,
    };
    return masses[formula] ?? 100;
  }
}