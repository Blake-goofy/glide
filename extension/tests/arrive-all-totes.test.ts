import { beforeEach, describe, expect, it, vi } from 'vitest';

import { callBridgeUserAction, showBridgeToast } from '../src/features/bridge-client';
import { installArriveAllTotes } from '../src/features/arrive-all-totes';

vi.mock('../src/features/bridge-client', () => ({
  callBridgeUserAction: vi.fn(),
  showBridgeToast: vi.fn(async () => true),
}));

describe('Arrive All Totes feature', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(callBridgeUserAction).mockReset();
    vi.mocked(showBridgeToast).mockReset();
    vi.mocked(showBridgeToast).mockResolvedValue(true);
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    localStorage.clear();
    localStorage.setItem('MachineName', 'Packing Station 2');
    window.history.replaceState({}, '', 'http://localhost/scale/trans/ex22slotstaxpalletbuild');
  });

  it('injects the menu action and toggles disabled state from the in-transit tote count', async () => {
    document.body.innerHTML = `
      <ul>
        <li>
          <a id="EX22PalBuildActionsDropdown" href="#">Actions</a>
          <ul class="dropdown-menu">
            <li class="dropdownaction menubutton"><a href="#">Existing action</a></li>
          </ul>
        </li>
      </ul>
      <div id="EX22PalBuildToteStatusTotesInTransitValue"><input value="0"></div>
      <div id="PalletId"><input value="PALLET-100"></div>
    `;

    const cleanup = installArriveAllTotes();
    const link = document.getElementById('GlideArriveAllTotesAction') as HTMLAnchorElement;

    expect(link).not.toBeNull();
    expect(link.getAttribute('aria-disabled')).toBe('true');

    (document.querySelector('#EX22PalBuildToteStatusTotesInTransitValue input') as HTMLInputElement).value = '2';
    document.querySelector('#EX22PalBuildToteStatusTotesInTransitValue input')?.dispatchEvent(new Event('input', { bubbles: true }));
    await flushAnimationFrame();

    expect(link.getAttribute('aria-disabled')).toBe('false');

    cleanup();
  });

  it('injects the menu action when the actions menu mounts later', async () => {
    const cleanup = installArriveAllTotes();

    expect(document.getElementById('GlideArriveAllTotesAction')).toBeNull();

    document.body.innerHTML = `
      <ul>
        <li>
          <a id="EX22PalBuildActionsDropdown" href="#">Actions</a>
          <ul class="dropdown-menu"></ul>
        </li>
      </ul>
      <div id="EX22PalBuildToteStatusTotesInTransitValue"><input value="1"></div>
      <div id="PalletId"><input value="PALLET-100"></div>
    `;
    await flushAnimationFrame();

    expect(document.getElementById('GlideArriveAllTotesAction')).toBeInstanceOf(HTMLAnchorElement);

    cleanup();
  });

  it('updates the disabled state when the in-transit value comes from a named input field', async () => {
    document.body.innerHTML = `
      <ul>
        <li>
          <a id="EX22PalBuildActionsDropdown" href="#">Actions</a>
          <ul class="dropdown-menu">
            <li class="dropdownaction menubutton"><a href="#">Existing action</a></li>
          </ul>
        </li>
      </ul>
      <input name="EX22PalBuildToteStatusTotesInTransitValue" value="0">
      <input name="PalletId" value="PALLET-100">
    `;

    const cleanup = installArriveAllTotes();
    const link = document.getElementById('GlideArriveAllTotesAction') as HTMLAnchorElement;
    const inTransitInput = document.querySelector('input[name="EX22PalBuildToteStatusTotesInTransitValue"]') as HTMLInputElement;

    expect(link.getAttribute('aria-disabled')).toBe('true');

    inTransitInput.value = '1';
    document.getElementById('EX22PalBuildActionsDropdown')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(link.getAttribute('aria-disabled')).toBe('false');

    cleanup();
  });

  it('rechecks the disabled state when the actions dropdown is opened after pallet details load', () => {
    document.body.innerHTML = `
      <ul>
        <li>
          <a id="EX22PalBuildActionsDropdown" href="#">Actions</a>
          <ul class="dropdown-menu"></ul>
        </li>
      </ul>
      <div id="EX22PalBuildToteStatusTotesInTransitValue"><input value="0"></div>
      <div id="PalletId"><input value="PALLET-100"></div>
    `;

    const cleanup = installArriveAllTotes();
    const link = document.getElementById('GlideArriveAllTotesAction') as HTMLAnchorElement;
    const inTransitInput = document.querySelector('#EX22PalBuildToteStatusTotesInTransitValue input') as HTMLInputElement;

    expect(link.getAttribute('aria-disabled')).toBe('true');

    inTransitInput.value = '1';
    document.getElementById('EX22PalBuildActionsDropdown')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(link.getAttribute('aria-disabled')).toBe('false');

    cleanup();
  });

  it('requests approval and routes GetSessionInfo plus ArriveAllTotes through the bridge client', async () => {
    document.body.innerHTML = `
      <ul>
        <li>
          <a id="EX22PalBuildActionsDropdown" href="#">Actions</a>
          <ul class="dropdown-menu"></ul>
        </li>
      </ul>
      <div id="EX22PalBuildToteStatusTotesInTransitValue"><input value="3"></div>
      <div id="PalletId"><input value="PALLET-100"></div>
    `;

    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.mocked(callBridgeUserAction)
      .mockResolvedValueOnce({ SelectedActivityType: 'Packing' })
      .mockResolvedValueOnce({ Message: 'Totes marked as arrived.' });

    const cleanup = installArriveAllTotes();
    const link = document.getElementById('GlideArriveAllTotesAction') as HTMLAnchorElement;

    link.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const input = await getLeadApprovalInput();
    const form = document.getElementById('GlideArriveAllTotesApprovalForm') as HTMLFormElement;

    input.value = 'AAT-LEAD-CODE-1573';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(callBridgeUserAction).toHaveBeenCalledTimes(2);
    });

    expect(callBridgeUserAction).toHaveBeenNthCalledWith(1, 'GetSessionInfo', 'INIT', 'Packing Station 2');
    expect(callBridgeUserAction).toHaveBeenNthCalledWith(2, 'ArriveAllTotes', 'Packing', 'PALLET-100');
    expect(showBridgeToast).toHaveBeenCalledWith('Totes marked as arrived.', 'success');
    expect(window.alert).not.toHaveBeenCalled();

    cleanup();
  });

  it('opens a SCALE-like approval modal and shows inline validation for the wrong code', async () => {
    document.body.innerHTML = `
      <ul>
        <li>
          <a id="EX22PalBuildActionsDropdown" href="#">Actions</a>
          <ul class="dropdown-menu"></ul>
        </li>
      </ul>
      <div id="EX22PalBuildToteStatusTotesInTransitValue"><input value="1"></div>
      <div id="PalletId"><input value="PALLET-100"></div>
    `;

    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(window, 'prompt').mockImplementation(() => {
      throw new Error('prompt should not be used');
    });

    const cleanup = installArriveAllTotes();
    const link = document.getElementById('GlideArriveAllTotesAction') as HTMLAnchorElement;

    link.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const modal = await vi.waitFor(() => document.getElementById('GlideArriveAllTotesModal') as HTMLDivElement | null);
    const input = await getLeadApprovalInput();
    const form = document.getElementById('GlideArriveAllTotesApprovalForm') as HTMLFormElement;
    const error = document.getElementById('GlideArriveAllTotesApprovalError') as HTMLElement;

    expect(modal?.style.display).toBe('block');

    input.value = 'WRONG-CODE';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(error.textContent).toBe('Team lead code was not accepted.');
    });

    expect(callBridgeUserAction).not.toHaveBeenCalled();
    expect(showBridgeToast).not.toHaveBeenCalled();

    cleanup();
  });
});

async function getLeadApprovalInput(): Promise<HTMLInputElement> {
  return vi.waitFor(() => {
    const input = document.getElementById('GlideArriveAllTotesApprovalCode');

    expect(input).toBeInstanceOf(HTMLInputElement);
    return input as HTMLInputElement;
  });
}

async function flushAnimationFrame(): Promise<void> {
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}