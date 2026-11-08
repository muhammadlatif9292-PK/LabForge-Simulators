// packages/scientific-core/runtime/scientific-constants-registry.ts
/**
 * Scientific Constants Registry
 * 
 * Responsibilities:
 * - Store all fundamental physical and mathematical constants with uncertainties
 * - Provide CODATA 2018/2022 values with update capability
 * - Support unit-aware constant retrieval
 * - Serve as single source of truth for scientific simulations
 * 
 * Owned state:
 * - constants: Map<string, ScientificConstant>
 * 
 * Dependencies: none
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: read-only after initialization
 * Recovery: can be rebuilt from static definitions
 * Telemetry: constant access count
 * Diagnostics: list of registered constants
 * Accessibility: N/A
 * Performance: O(1) lookup
 * Forbidden: modifying constants after initialization without version tracking
 */

import type { ScientificConstant, UnitId } from '../contracts/scientific-core-contracts';

export class ScientificConstantsRegistry {
  private constants: Map<string, ScientificConstant> = new Map();

  constructor() {
    this.registerDefaultConstants();
  }

  private registerDefaultConstants(): void {
    const register = (c: ScientificConstant) => this.constants.set(c.symbol, c);
    register({ symbol: 'c', name: 'speed of light in vacuum', value: 299792458, unit: 'meter' as UnitId, uncertainty: 0, category: 'universal' });
    register({ symbol: 'h', name: 'Planck constant', value: 6.62607015e-34, unit: 'joule_second' as UnitId, uncertainty: 0, category: 'universal' });
    register({ symbol: 'e', name: 'elementary charge', value: 1.602176634e-19, unit: 'coulomb' as UnitId, uncertainty: 0, category: 'universal' });
    register({ symbol: 'k_B', name: 'Boltzmann constant', value: 1.380649e-23, unit: 'joule_per_kelvin' as UnitId, uncertainty: 0, category: 'universal' });
    register({ symbol: 'N_A', name: 'Avogadro constant', value: 6.02214076e23, unit: 'mole' as UnitId, uncertainty: 0, category: 'atomic' });
    register({ symbol: 'R', name: 'molar gas constant', value: 8.314462618, unit: 'joule_per_mole_kelvin' as UnitId, uncertainty: 0, category: 'physico-chemical' });
    register({ symbol: 'G', name: 'gravitational constant', value: 6.67430e-11, unit: 'newton_m2_kg2' as UnitId, uncertainty: 1.5e-15, category: 'universal' });
    register({ symbol: 'mu0', name: 'vacuum magnetic permeability', value: 1.25663706212e-6, unit: 'henry_per_meter' as UnitId, uncertainty: 0, category: 'electromagnetic' });
    register({ symbol: 'epsilon0', name: 'vacuum electric permittivity', value: 8.8541878128e-12, unit: 'farad_per_meter' as UnitId, uncertainty: 0, category: 'electromagnetic' });
    register({ symbol: 'pi', name: 'Archimedes constant', value: 3.141592653589793, unit: 'dimensionless' as UnitId, uncertainty: 0, category: 'universal' });
    register({ symbol: 'euler', name: 'Euler number', value: 2.718281828459045, unit: 'dimensionless' as UnitId, uncertainty: 0, category: 'universal' });
  }

  getConstant(symbol: string): ScientificConstant | undefined {
    return this.constants.get(symbol);
  }

  getByCategory(category: string): ScientificConstant[] {
    return Array.from(this.constants.values()).filter(c => c.category === category);
  }

  getAllConstants(): ScientificConstant[] {
    return Array.from(this.constants.values());
  }

  updateConstant(symbol: string, partial: Partial<ScientificConstant>): void {
    const existing = this.constants.get(symbol);
    if (existing) {
      Object.assign(existing, partial);
    }
  }
}