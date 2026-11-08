import { holdemNoLimit } from '@/engine/variants/holdem';
import type { VariantDefinition, VariantId } from '@/engine/variants/types';

const VARIANTS: Record<VariantId, VariantDefinition> = {
  'holdem-nl': holdemNoLimit,
};

export function getVariant(id: VariantId): VariantDefinition {
  return VARIANTS[id];
}
