import { SubstanceNode } from './SubstanceNode';
import { ContainerNode } from './ContainerNode';
import { ConditionNode } from './ConditionNode';
import { SensorNode } from './SensorNode';
import { ActionNode } from './ActionNode';
import { OutputNode } from './OutputNode';

/**
 * Graph nodes library entry point.
 */
export const nodeTypes = {
  substance: SubstanceNode,
  container: ContainerNode,
  condition: ConditionNode,
  sensor: SensorNode,
  action: ActionNode,
  output: OutputNode,
};
