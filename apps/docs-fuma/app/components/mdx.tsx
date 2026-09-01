import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Callout } from 'fumadocs-ui/components/callout';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import {
  Rocket,
  Boxes,
  KeyRound,
  LayoutGrid,
  MonitorSmartphone,
  Package,
  Puzzle,
  Workflow,
  ShieldCheck,
  Cable,
  PlayCircle,
  Wallet,
  Coins,
} from 'lucide-react';
import type { MDXComponents } from 'mdx/types';
import { Preview } from './preview';
import { CompatibilityMatrix } from './compatibility-matrix';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Callout,
    Card,
    Cards,
    Tab,
    Tabs,
    Step,
    Steps,
    Preview,
    CompatibilityMatrix,
    // icons usable inside MDX, e.g. <Card icon={<Boxes />} ... />
    Rocket,
    Boxes,
    KeyRound,
    LayoutGrid,
    MonitorSmartphone,
    Package,
    Puzzle,
    Workflow,
    ShieldCheck,
    Cable,
    Wallet,
    Coins,
    PlayCircle,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
