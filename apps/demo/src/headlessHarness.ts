/**
 * S18 — a bare, **unstyled** harness that consumes the headless flows. No CSS,
 * no framework: plain DOM + the a11y prop-getters. The styled layer (S20) is
 * design-gated; this proves the headless primitives drive the full
 * create/sign/recover journey on their own. S21 mounts this against the kit.
 */
import {
  createCreatePasskeyFlow,
  createRecoverFlow,
  createSignFlow,
  type CreateFlowConfig,
  type RecoverFlowConfig,
  type SignFlowConfig,
  type StatusProps,
  type TriggerProps,
} from '@soropass/ui/headless';

export interface HarnessConfigs {
  create: CreateFlowConfig;
  sign: SignFlowConfig;
  recover: RecoverFlowConfig;
}

function applyTrigger(button: HTMLButtonElement, props: TriggerProps): void {
  button.type = props.type;
  button.disabled = props.disabled;
  button.setAttribute('aria-busy', String(props['aria-busy']));
  button.setAttribute('aria-label', props['aria-label']);
  button.textContent = props['aria-label'];
  button.onclick = props.onClick;
}

function applyStatus(el: HTMLElement, props: StatusProps): void {
  el.setAttribute('role', props.role);
  el.setAttribute('aria-live', props['aria-live']);
  el.setAttribute('aria-atomic', String(props['aria-atomic']));
  el.tabIndex = props.tabIndex;
  el.textContent = props.children;
}

/** Mount the three headless flows as plain, unstyled DOM. Returns an unmount fn. */
export function mountHeadlessHarness(root: HTMLElement, configs: HarnessConfigs): () => void {
  const doc = root.ownerDocument;
  const unsubscribers: Array<() => void> = [];

  const section = (
    heading: string,
  ): { wrap: HTMLElement; button: HTMLButtonElement; status: HTMLElement } => {
    const wrap = doc.createElement('section');
    const h = doc.createElement('h2');
    h.textContent = heading;
    const button = doc.createElement('button');
    const status = doc.createElement('p');
    wrap.append(h, button, status);
    root.append(wrap);
    return { wrap, button, status };
  };

  // create
  const createFlow = createCreatePasskeyFlow(configs.create);
  const createUi = section('Create');
  const renderCreate = (): void => {
    applyTrigger(createUi.button, createFlow.getTriggerProps());
    applyStatus(createUi.status, createFlow.getStatusProps());
  };
  unsubscribers.push(createFlow.subscribe(renderCreate));
  renderCreate();

  // sign
  const signFlow = createSignFlow(configs.sign);
  const signUi = section('Sign');
  const renderSign = (): void => {
    applyTrigger(signUi.button, signFlow.getTriggerProps());
    applyStatus(signUi.status, signFlow.getStatusProps());
  };
  unsubscribers.push(signFlow.subscribe(renderSign));
  renderSign();

  // recover (with an accessible listbox of resolved accounts)
  const recoverFlow = createRecoverFlow(configs.recover);
  const recoverUi = section('Recover');
  const list = doc.createElement('div');
  recoverUi.wrap.append(list);
  const renderRecover = (): void => {
    applyTrigger(recoverUi.button, recoverFlow.getTriggerProps());
    applyStatus(recoverUi.status, recoverFlow.getStatusProps());
    list.replaceChildren();
    const state = recoverFlow.getState();
    if (state.status === 'resolved') {
      const listProps = recoverFlow.getListProps();
      list.setAttribute('role', listProps.role);
      list.setAttribute('aria-label', listProps['aria-label']);
      state.accounts.forEach((account, index) => {
        const optionProps = recoverFlow.getOptionProps(account, index);
        const option = doc.createElement('button');
        option.id = optionProps.id;
        option.setAttribute('role', optionProps.role);
        option.setAttribute('aria-selected', String(optionProps['aria-selected']));
        option.tabIndex = optionProps.tabIndex;
        option.textContent = account.contractId;
        option.onclick = optionProps.onClick;
        list.append(option);
      });
    }
  };
  unsubscribers.push(recoverFlow.subscribe(renderRecover));
  renderRecover();

  return () => {
    for (const off of unsubscribers) off();
    root.replaceChildren();
  };
}
